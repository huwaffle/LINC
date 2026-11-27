import { describe, expect, it } from "vitest";
import {
  RECEIPT_ALPHABET,
  createReceiptCode,
  formatReceiptCode,
  hashReceiptCode,
  normalizeReceiptCode,
} from "../lib/receipt-code";

describe("receipt codes", () => {
  it("uses an unambiguous alphabet", () => {
    expect(RECEIPT_ALPHABET).not.toContain("I");
    expect(RECEIPT_ALPHABET).not.toContain("O");
    expect(RECEIPT_ALPHABET).not.toContain("0");
    expect(RECEIPT_ALPHABET).not.toContain("1");
  });

  it("creates a grouped 12-character code", () => {
    const code = createReceiptCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(normalizeReceiptCode(code)).toHaveLength(12);
    expect(formatReceiptCode(code)).toBe(code);
  });

  it("normalizes lowercase and spacing", () => {
    expect(normalizeReceiptCode(" abcd-efgh-jkmn ")).toBe("ABCDEFGHJKMN");
    expect(normalizeReceiptCode("ABCD EFGH JKMN")).toBe("ABCDEFGHJKMN");
  });

  it("rejects wrong lengths and ambiguous characters", () => {
    expect(normalizeReceiptCode("ABCD-EFGH")).toBeNull();
    expect(normalizeReceiptCode("ABCD-EFGH-JKMO")).toBeNull();
    expect(normalizeReceiptCode("ABCD-EFGH-JKM0")).toBeNull();
    expect(normalizeReceiptCode("ABCD-EFGH-JKM1")).toBeNull();
  });

  it("hashes deterministically without storing the plaintext", () => {
    const code = "ABCD-EFGH-JKMN";
    const first = hashReceiptCode(code);
    const second = hashReceiptCode("abcdefghjkmn");

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("ABCD");
  });

  it("gives different codes different hashes", () => {
    expect(hashReceiptCode("ABCD-EFGH-JKMN")).not.toBe(hashReceiptCode("ABCD-EFGH-JKMP"));
  });

  it("refuses to hash an invalid code", () => {
    expect(() => hashReceiptCode("not-a-code")).toThrow(/invalid/i);
  });
});
