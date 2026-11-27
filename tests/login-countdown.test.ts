import { describe, expect, it } from "vitest";
import { formatLockCountdown } from "../lib/auth/login-countdown";

describe("login lock countdown", () => {
  it("formats the full three-minute lock as 3:00", () => {
    expect(formatLockCountdown(3 * 60 * 1000)).toBe("3:00");
  });

  it("pads seconds and rounds up partial seconds", () => {
    expect(formatLockCountdown(59_400)).toBe("1:00");
    expect(formatLockCountdown(59_000)).toBe("0:59");
    expect(formatLockCountdown(4_200)).toBe("0:05");
  });

  it("clamps expired or invalid values to 0:00", () => {
    expect(formatLockCountdown(0)).toBe("0:00");
    expect(formatLockCountdown(-1_000)).toBe("0:00");
  });
});
