import { z } from "zod";

export const entrySchema = z.object({
  title: z.string().trim().min(1, "Add a title for your post."),
  body: z.string().trim().min(1, "Add some details for your post."),
  categoryId: z.string().optional().default(""),
  isAnonymous: z.coerce.boolean().default(false),
});

export const accountSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Add a nickname.")
    .max(60, "Nicknames must be 60 characters or fewer."),
});

export const commentSchema = z.object({
  entryId: z.string().min(1),
  parentId: z.string().optional(),
  body: z.string().trim().min(2, "Comment is too short.").max(1000),
  isAnonymous: z.coerce.boolean().default(false),
});

export const eventSchema = z.object({
  title: z.string().trim().min(6, "Event title is too short.").max(120),
  description: z.string().trim().min(20, "Describe the event in at least 20 characters.").max(3000),
  location: z.string().trim().min(3, "Location is required.").max(160),
  registrationUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => !v || /^https?:\/\//.test(v), "Registration link must start with http:// or https://"),
  startsAt: z.string().min(1, "Choose a date and time."),
});

export const reportSchema = z.object({
  entryId: z.string().min(1),
  reason: z.string().trim().min(5, "Please give a short reason.").max(500),
});

export const moderationSchema = z.object({
  entryId: z.string().min(1),
  action: z.enum(["publish", "reject", "redact"]),
  reason: z.string().trim().max(500).optional(),
});

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

export function formatZod(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(" ");
}
