import { safetyConfig } from "./config";
import type { SafetyAssessment, SafetyItem, SafetySeverity } from "./types";

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    results: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          severity: {
            type: "STRING",
            enum: ["none", "low", "medium", "high"],
          },
          categories: { type: "ARRAY", items: { type: "STRING" } },
          matchedTerms: { type: "ARRAY", items: { type: "STRING" } },
          explanation: { type: "STRING" },
        },
        required: ["id", "severity", "categories", "matchedTerms", "explanation"],
      },
    },
  },
  required: ["results"],
} as const;

export const SAFETY_SYSTEM_PROMPT = `You are a content-safety reviewer for LINC, a university campus community in the Philippines.
Review each item for foul or inappropriate language: profanity, slurs, sexual content, harassment, bullying, threats, hate speech, drug promotion, and encouragement of self-harm or violence.
Items may be post titles and bodies, comments and replies, or account display names and usernames submitted at signup or profile editing. Flag those comment and account items too when they contain inappropriate language.
Understand English, Filipino/Tagalog, and common obfuscations (for example "sh1t", "f*ck", "putangina", "g4go", or repeated letters).
Do not flag legitimate academic discussion, quoted material that is clearly being criticized, or ordinary disagreement. Use the surrounding text to judge intent.
Severity: "high" for threats, slurs, sexual content, or targeted harassment; "medium" for clear profanity or abusive language; "low" for mild profanity; "none" when no issue exists.
Return every input id exactly once. Keep matchedTerms to the actual words or short phrases that caused the flag, and explain the decision in one short sentence.`;

const MAX_PROMPT_TERMS = 200;

/**
 * Appends the administrator's word filters to the model instructions. Keeping
 * this separate makes it easy to test and avoids rebuilding the base prompt.
 */
export function customTermsInstruction(terms: string[]): string {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const raw of terms) {
    const term = raw.replace(/"/g, "'").trim().slice(0, 60);
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(term);
    if (cleaned.length >= MAX_PROMPT_TERMS) break;
  }

  if (cleaned.length === 0) return "";

  return `\nThe administrator added these words and phrases to the offensive-language filter: ${cleaned
    .map((term) => `"${term}"`)
    .join(", ")}. Treat them as offensive even if they are slang, and report them when they are used as insults or abuse.`;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

type GeminiPayload = {
  results?: Array<{
    id?: unknown;
    severity?: unknown;
    categories?: unknown;
    matchedTerms?: unknown;
    explanation?: unknown;
  }>;
};

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function severity(value: unknown): SafetySeverity {
  return value === "low" || value === "medium" || value === "high" ? value : "none";
}

function parseJson(text: string): GeminiPayload {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as GeminiPayload;
}

/**
 * Sends one batch to Gemini and returns a map keyed by the ids supplied by the
 * caller. Throws on network/API/parse failures so the caller can fall back.
 */
export async function assessWithGemini(
  items: SafetyItem[],
  customTerms: string[] = [],
): Promise<Map<string, SafetyAssessment>> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const config = safetyConfig();
  const payload = items.map((item) => ({
    id: item.id,
    kind: item.targetType,
    text: item.text.slice(0, config.maxCharsPerItem),
  }));

  const response = await fetch(
    `${ENDPOINT}/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SAFETY_SYSTEM_PROMPT + customTermsInstruction(customTerms) }],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Review these ${payload.length} item(s):\n${JSON.stringify(payload)}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Gemini returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  const text = json.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned an empty response.");

  const parsed = parseJson(text);
  if (!Array.isArray(parsed.results)) throw new Error("Gemini returned no results array.");

  const wanted = new Set(items.map((item) => item.id));
  const assessments = new Map<string, SafetyAssessment>();
  for (const result of parsed.results) {
    if (typeof result.id !== "string" || !wanted.has(result.id)) continue;
    assessments.set(result.id, {
      severity: severity(result.severity),
      categories: stringList(result.categories),
      matchedTerms: stringList(result.matchedTerms),
      explanation:
        typeof result.explanation === "string" && result.explanation.trim()
          ? result.explanation.trim()
          : "Gemini returned no explanation.",
      provider: "gemini",
    });
  }
  return assessments;
}

/** Splits a scan into model-sized requests. */
export function chunks<T>(items: T[], size = safetyConfig().batchSize): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}
