import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Isolated end-to-end verification.
 *
 * The normal `next build` writes into `.next`, which is exactly the folder a
 * running `next dev` is using. This script gives the verification run its own
 * dist folder, database, and port, so the developer can keep the dev server on
 * :3000 alive while the suite runs. Point VERIFY_DATABASE_URL at a disposable
 * Supabase database; media is written to that project's Storage buckets.
 */

const root = process.cwd();
const port = Number(process.env.VERIFY_PORT ?? 3100);
const distDir = process.env.VERIFY_DIST_DIR ?? ".next-verify";
const dbPath = process.env.VERIFY_DATABASE_URL;
if (!dbPath) throw new Error("VERIFY_DATABASE_URL must point at a disposable Supabase Postgres database.");
const baseUrl = `http://localhost:${port}`;

const env = {
  ...process.env,
  NEXT_DIST_DIR: distDir,
  DATABASE_URL: dbPath,
  SESSION_SECRET: process.env.SESSION_SECRET ?? "local-dev-secret-please-change-32chars",
  AUTH_MODE: process.env.AUTH_MODE ?? "demo",
  BASE_URL: baseUrl,
};

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const tsxBin = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

function log(step) {
  console.log(`\n[linc verify] ${step}`);
}

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}`));
    });
  });
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

async function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

let server;
let exitCode = 0;

try {
  log(`Resetting isolated database at ${dbPath}`);
  await run(process.execPath, [tsxBin, "scripts/reset-db.ts"], "db reset");

  log("Seeding demo ads");
  await run(process.execPath, [tsxBin, "scripts/seed-ads.ts"], "ad seed");

  log("Seeding accounts with a known password");
  await run(process.execPath, [tsxBin, "scripts/seed-e2e-users.ts"], "e2e user seed");

  log(`Building into ${distDir}`);
  await run(process.execPath, [nextBin, "build"], "next build");

  log(`Starting production server on ${baseUrl}`);
  server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  await waitForServer(baseUrl);

  log("Running browser checks");
  await run(process.execPath, ["tests/e2e-check.mjs"], "e2e checks");

  log("Passed");
} catch (error) {
  exitCode = 1;
  console.error(`\n[linc verify] ${error.message}`);
} finally {
  stopProcess(server);
  // Drop the verification build so repeated runs start clean. The Supabase
  // project itself is left intact for inspection.
  fs.rmSync(path.resolve(root, distDir), { recursive: true, force: true });
}

process.exit(exitCode);
