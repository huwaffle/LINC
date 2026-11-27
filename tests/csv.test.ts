import { describe, expect, it } from "vitest";
import { csvTimestamp, csvValue, toCsv } from "../lib/csv";

describe("csv export", () => {
  it("quotes cells that contain commas or quotes", () => {
    expect(csvValue("plain")).toBe("plain");
    expect(csvValue("one, two")).toBe('"one, two"');
    expect(csvValue('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvValue(null)).toBe("");
  });

  it("writes a header row and one row per record", () => {
    const csv = toCsv(
      [
        { title: "Shuttle update", status: "published" },
        { title: "Missing, facilities", status: "pending" },
      ],
      [
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
      ],
    );

    expect(csv.split("\r\n")).toEqual([
      "Title,Status",
      "Shuttle update,published",
      '"Missing, facilities",pending',
    ]);
  });

  it("exports sortable ISO timestamps and blanks for missing dates", () => {
    expect(csvTimestamp(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(csvTimestamp(null)).toBe("");
  });
});
