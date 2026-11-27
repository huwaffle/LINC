import postgres from "postgres";

/**
 * Supabase PostgreSQL connection plus a small compatibility surface that
 * mirrors the `sqlite.prepare(...).get/all/run` calls used across the app.
 * The SQL still uses `?` placeholders; they are rewritten to PostgreSQL's
 * `$1, $2, ...` form before execution.
 *
 * The connection is created on first use (never at module load) so `next
 * build` does not require a live database or a configured connection string.
 */

type Param = unknown;
type Row = Record<string, unknown>;

export interface PreparedStatement<T = Row> {
  all(...params: Param[]): Promise<T[]>;
  get(...params: Param[]): Promise<T | undefined>;
  run(...params: Param[]): Promise<{ changes: number }>;
}

export interface DatabaseClient {
  prepare<T = Row>(query: string): PreparedStatement<T>;
  transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T>;
  /** Execute a raw multi-statement SQL script (used by the migration runner). */
  exec(query: string): Promise<void>;
}

type SqlValues = postgres.ParameterOrJSON<never>[];

let pool: postgres.Sql | null = null;

function connection(): postgres.Sql {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at your Supabase Postgres connection string.",
    );
  }
  let local = false;
  try {
    local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url).hostname);
  } catch {
    // postgres.js also accepts keyword/value connection strings.
  }
  pool = postgres(url, {
    max: Number(process.env.PGPOOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    // Supabase pooler (PgBouncer) does not support named prepared statements.
    prepare: false,
    ssl: local ? false : "require",
    // Epoch-millisecond timestamps are stored as bigint but read as numbers.
    types: {
      bigint: {
        to: 20,
        from: [20],
        serialize: (value: number | bigint) => String(value),
        parse: (raw: string | number) => Number(raw),
      },
    },
  });
  return pool;
}

/** Rewrite SQLite-style `?` placeholders to PostgreSQL `$n` parameters. */
export function toPositional(query: string, params: Param[]): { text: string; values: Param[] } {
  let text = "";
  let used = 0;
  let quote: string | null = null;
  for (let i = 0; i < query.length; i += 1) {
    const ch = query[i];
    if (quote) {
      text += ch;
      if (ch === quote) {
        if (query[i + 1] === quote) text += query[++i];
        else quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      text += ch;
      continue;
    }
    if (ch === "?") {
      if (used >= params.length) {
        throw new Error(`Not enough parameters for SQL: ${query.slice(0, 120)}`);
      }
      text += `$${++used}`;
      continue;
    }
    text += ch;
  }
  if (used !== params.length) {
    throw new Error(`Too many parameters for SQL: ${query.slice(0, 120)}`);
  }
  return { text, values: params };
}

async function all<T>(sqlClient: postgres.Sql, query: string, params: Param[]): Promise<T[]> {
  const { text, values } = toPositional(query, params);
  return await sqlClient.unsafe<T[]>(text, values as SqlValues);
}

async function get<T>(sqlClient: postgres.Sql, query: string, params: Param[]): Promise<T | undefined> {
  const rows = await all<T>(sqlClient, query, params);
  return rows[0];
}

async function run(sqlClient: postgres.Sql, query: string, params: Param[]): Promise<{ changes: number }> {
  const { text, values } = toPositional(query, params);
  const result = await sqlClient.unsafe(text, values as SqlValues);
  return { changes: result.count ?? result.length ?? 0 };
}

function client(getSql: () => postgres.Sql): DatabaseClient {
  return {
    prepare<T = Row>(query: string): PreparedStatement<T> {
      return {
        all: async (...params) => await all<T>(getSql(), query, params),
        get: async (...params) => await get<T>(getSql(), query, params),
        run: async (...params) => await run(getSql(), query, params),
      };
    },
    async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
      return (await getSql().begin(async (tx) => await fn(client(() => tx as unknown as postgres.Sql)))) as T;
    },
    async exec(query: string): Promise<void> {
      await getSql().unsafe(query);
    },
  };
}

export const sqlite: DatabaseClient = client(connection);

/** True when the Supabase schema has been applied. */
export async function isMigrated(): Promise<boolean> {
  const row = await get<{ exists: boolean }>(
    connection(),
    `select exists (
       select 1 from information_schema.tables
       where table_schema = 'public' and table_name = 'entries'
     ) as exists`,
    [],
  );
  return Boolean(row?.exists);
}

/** Close the pool from one-off scripts so they can exit cleanly. */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export type { DatabaseClient as SqliteDatabase };
