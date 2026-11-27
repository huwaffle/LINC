/**
 * Single source of truth for the seeded demo identities.
 *
 * This file is the source of truth for the seeded demo accounts;
 * keep both in sync. There is only one administrator (USC) and students.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const DEMO_ACCOUNT_PASSWORD = "12345678";

export const DEMO_ADMIN = {
  // Keep the stable internal id used throughout the app; the sign-in name is `usc`.
  id: "user-admin",
  username: "usc",
  email: "usc@dlsau.edu.ph",
  displayName: "USC Administrator",
} as const;

export const DEMO_STUDENTS = [
  { firstName: "Juan", lastName: "Cruz" },
  { firstName: "Maria", lastName: "Santos" },
  { firstName: "Jose", lastName: "Garcia" },
  { firstName: "Ana", lastName: "Reyes" },
  { firstName: "Miguel", lastName: "Torres" },
  { firstName: "Sofia", lastName: "Mendoza" },
  { firstName: "Liam", lastName: "Bautista" },
  { firstName: "Emma", lastName: "Villanueva" },
  { firstName: "Ethan", lastName: "Ramos" },
  { firstName: "Ava", lastName: "Hernandez" },
  { firstName: "Noah", lastName: "Castro" },
  { firstName: "Isabella", lastName: "Flores" },
  { firstName: "Lucas", lastName: "Gutierrez" },
  { firstName: "Mia", lastName: "Perez" },
  { firstName: "Mateo", lastName: "Lopez" },
  { firstName: "Amelia", lastName: "Rivera" },
  { firstName: "Gabriel", lastName: "Silva" },
  { firstName: "Chloe", lastName: "Martinez" },
  { firstName: "Rafael", lastName: "Co" },
  { firstName: "Grace", lastName: "Lim" },
  { firstName: "Daniel", lastName: "Tan" },
  { firstName: "Hannah", lastName: "Ong" },
  { firstName: "Joshua", lastName: "Lee" },
  { firstName: "Nicole", lastName: "Chua" },
  { firstName: "Adrian", lastName: "Dy" },
  { firstName: "Camille", lastName: "Uy" },
  { firstName: "Patrick", lastName: "Ng" },
  { firstName: "Samantha", lastName: "Go" },
  { firstName: "Vincent", lastName: "Sy" },
  { firstName: "Andrea", lastName: "Que" },
  { firstName: "Carlo", lastName: "Chan" },
  { firstName: "Denise", lastName: "Yap" },
  { firstName: "Erik", lastName: "Siao" },
  { firstName: "Faith", lastName: "Ching" },
] as const;

export type DemoStudent = (typeof DEMO_STUDENTS)[number];

export function studentUsername(student: DemoStudent): string {
  return student.firstName.toLowerCase();
}

export function studentEmail(student: DemoStudent): string {
  return `${studentUsername(student)}.${student.lastName.toLowerCase()}@dlsau.edu.ph`;
}

export function studentDisplayName(student: DemoStudent): string {
  return `${student.firstName} ${student.lastName}`;
}

export function studentId(student: DemoStudent): string {
  return `user-${studentUsername(student)}`;
}

export const DEMO_STUDENT_IDS: readonly string[] = DEMO_STUDENTS.map(studentId);
