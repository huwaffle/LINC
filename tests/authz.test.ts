import { describe, expect, it } from "vitest";
import { can } from "../lib/authz";
import type { SessionUser } from "../lib/auth/token";

const student: SessionUser = {
  id: "user-juan",
  username: "juan",
  role: "student",
  displayName: "Juan Cruz",
};

const admin: SessionUser = {
  id: "user-admin",
  username: "usc",
  role: "admin",
  displayName: "USC Administrator",
};

describe("authorization policy", () => {
  it("lets anyone read published content", () => {
    expect(can(null).readPublished()).toBe(true);
    expect(can(student).readPublished()).toBe(true);
    expect(can(admin).readPublished()).toBe(true);
  });

  it("prevents guests from submitting, commenting, or RSVPing", () => {
    expect(can(null).isSignedIn()).toBe(false);
    expect(can(null).submitEntry()).toBe(false);
    expect(can(null).comment()).toBe(false);
    expect(can(null).rsvp()).toBe(false);
    expect(can(null).report()).toBe(false);
  });

  it("lets signed-in students submit, comment, report, and RSVP", () => {
    expect(can(student).isSignedIn()).toBe(true);
    expect(can(student).submitEntry()).toBe(true);
    expect(can(student).comment()).toBe(true);
    expect(can(student).report()).toBe(true);
    expect(can(student).rsvp()).toBe(true);
  });

  it("lets authors preview their own non-anonymous drafts", () => {
    expect(can(student).viewOwnDraft({ authorId: student.id, isAnonymous: false })).toBe(true);
    expect(can(student).viewOwnDraft({ authorId: student.id, isAnonymous: true })).toBe(false);
    expect(can(student).viewOwnDraft({ authorId: admin.id, isAnonymous: false })).toBe(false);
  });

  it("keeps unpublished entries and moderation admin-only", () => {
    expect(can(admin).viewUnpublished({ status: "pending" })).toBe(true);
    expect(can(admin).moderate({ status: "pending" })).toBe(true);
    expect(can(student).viewUnpublished({ status: "pending" })).toBe(false);
    expect(can(student).moderate({ status: "pending" })).toBe(false);
    expect(can(null).viewUnpublished({ status: "pending" })).toBe(false);
    expect(can(null).moderate({ status: "pending" })).toBe(false);
  });

  it("gives only the administrator console access", () => {
    expect(can(admin).adminOnly()).toBe(true);
    expect(can(student).adminOnly()).toBe(false);
    expect(can(null).adminOnly()).toBe(false);
  });

  it("restricts event publishing to the administrator", () => {
    expect(can(admin).publishEvent()).toBe(true);
    expect(can(student).publishEvent()).toBe(false);
    expect(can(null).publishEvent()).toBe(false);
  });
});
