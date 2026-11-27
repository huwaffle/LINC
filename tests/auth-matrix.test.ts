import { describe, expect, it } from "vitest";
import {
  DEMO_ACCOUNT_PASSWORD,
  DEMO_ADMIN,
  MIN_PASSWORD_LENGTH,
  authenticate,
} from "../lib/auth/provider";
import {
  DEMO_STUDENTS,
  studentEmail,
  studentId,
  studentUsername,
} from "../lib/auth/demo-accounts";
import { hashPassword, verifyPassword } from "../lib/auth/password";

describe("demo authentication matrix", () => {
  it("accepts the USC administrator credentials", () => {
    const user = authenticate(DEMO_ADMIN.username, DEMO_ACCOUNT_PASSWORD);
    expect(user?.role).toBe("admin");
    expect(user?.id).toBe("user-admin");
    expect(user?.username).toBe("usc");
    expect(user?.displayName).toBe("USC Administrator");
  });

  it("accepts the administrator email as well as the username", () => {
    expect(authenticate(DEMO_ADMIN.email, DEMO_ACCOUNT_PASSWORD)?.id).toBe(DEMO_ADMIN.id);
  });

  it("rejects the administrator with the wrong password", () => {
    expect(authenticate(DEMO_ADMIN.username, "not-the-demo-password")).toBeNull();
    expect(authenticate(DEMO_ADMIN.username, "")).toBeNull();
    expect(authenticate(DEMO_ADMIN.username, "admin1234")).toBeNull();
  });

  it("is case-insensitive and trims the administrator username", () => {
    expect(authenticate("USC", DEMO_ACCOUNT_PASSWORD)?.role).toBe("admin");
    expect(authenticate(" usc ", DEMO_ACCOUNT_PASSWORD)?.role).toBe("admin");
  });

  it("does not invent a legacy organization identity for old short codes", () => {
    for (const code of ["cast", "cbma", "cvmas", "coed"]) {
      expect(authenticate(code, DEMO_ACCOUNT_PASSWORD)).toBeNull();
      expect(authenticate(code, "anything1")).toBeNull();
    }
  });

  it.each(["20231001", "20231017", "202312345", "1", "000123"])(
    "does not authenticate numeric student number %s without a database row",
    (id) => {
      expect(authenticate(id, DEMO_ACCOUNT_PASSWORD)).toBeNull();
      expect(authenticate(id, "12345678")).toBeNull();
    },
  );

  it("rejects unknown usernames, including the retired administrator name", () => {
    expect(authenticate("hello", "anything")).toBeNull();
    expect(authenticate("admin", DEMO_ACCOUNT_PASSWORD)).toBeNull();
    expect(authenticate("usc2", DEMO_ACCOUNT_PASSWORD)).toBeNull();
    expect(authenticate("", "anything")).toBeNull();
  });

  it("rejects everything when AUTH_MODE is not demo", () => {
    expect(authenticate(DEMO_ADMIN.username, DEMO_ACCOUNT_PASSWORD, "production")).toBeNull();
    expect(authenticate(studentUsername(DEMO_STUDENTS[0]), DEMO_ACCOUNT_PASSWORD, "production")).toBeNull();
  });

  it("keeps the documented masterlist credentials usable", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(DEMO_ACCOUNT_PASSWORD.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
    expect(DEMO_STUDENTS).toHaveLength(34);

    const first = DEMO_STUDENTS[0];
    const last = DEMO_STUDENTS[DEMO_STUDENTS.length - 1];
    expect(studentUsername(first)).toBe("juan");
    expect(studentEmail(first)).toBe("juan.cruz@dlsau.edu.ph");
    expect(studentId(first)).toBe("user-juan");
    expect(studentUsername(last)).toBe("faith");
    expect(studentEmail(last)).toBe("faith.ching@dlsau.edu.ph");
  });

  it("verifies the password hash used by database-backed students", () => {
    const hash = hashPassword(DEMO_ACCOUNT_PASSWORD);
    expect(verifyPassword(DEMO_ACCOUNT_PASSWORD, hash)).toBe(true);
    expect(verifyPassword("a-different-password", hash)).toBe(false);
  });

  it("never lets the demo provider invent a student identity", () => {
    const student = DEMO_STUDENTS[0];
    expect(authenticate(studentUsername(student), DEMO_ACCOUNT_PASSWORD)).toBeNull();
    expect(authenticate(studentEmail(student), DEMO_ACCOUNT_PASSWORD)).toBeNull();
  });
});
