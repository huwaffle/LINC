export type CsvCell = string | number | null;

/** RFC 4180-style escaping: quotes are doubled and ambiguous cells wrapped. */
export function csvValue(value: CsvCell): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  rows: Array<Record<string, CsvCell>>,
  columns: Array<{ key: string; label: string }>,
): string {
  const header = columns.map((column) => csvValue(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => csvValue(row[column.key])).join(","));
  return [header, ...body].join("\r\n");
}

/** ISO timestamps make the exported files sortable in any spreadsheet. */
export function csvTimestamp(ms: CsvCell): string {
  if (typeof ms !== "number") return "";
  return new Date(ms).toISOString();
}
