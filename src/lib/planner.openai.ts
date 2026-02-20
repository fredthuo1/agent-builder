import OpenAI from "openai";
import type { AppPlan, GenerationMode } from "./types";

function stripCodeFences(s: string) {
  return String(s || "")
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    // try to salvage JSON object substring
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function validatePlanShape(plan: any): plan is AppPlan {
  return (
    plan &&
    typeof plan === "object" &&
    typeof plan.appName === "string" &&
    Array.isArray(plan.entities) &&
    plan.entities.every(
      (e: any) =>
        e &&
        typeof e === "object" &&
        typeof e.name === "string" &&
        Array.isArray(e.fields) &&
        e.fields.every((f: any) => f && typeof f.name === "string" && typeof f.type === "string")
    )
  );
}

/**
 * OpenAI planner: returns an AppPlan JSON.
 * Uses Responses API via the official SDK. :contentReference[oaicite:1]{index=1}
 */
export async function makePlanWithOpenAI(prompt: string, _modeRequested: GenerationMode): Promise<AppPlan> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const model = process.env.OPENAI_MODEL || "gpt-5";
  const client = new OpenAI({ apiKey });

  const instructions = [
    "You are a strict JSON generator that outputs a single JSON object and nothing else.",
    "Generate an AppPlan for a CRUD app (Express+SQLite backend + Next.js frontend).",
    "Return VALID JSON only (no markdown, no code fences).",
    "Schema:",
    "{",
    '  "appName": string,',
    '  "entities": [',
    "    {",
    '      "name": string,',
    '      "title"?: string,',
    '      "fields": [',
    "        {",
    '          "name": string,',
    '          "type": "string"|"text"|"number"|"boolean"|"date"|"enum",',
    '          "required"?: boolean,',
    '          "enumValues"?: string[]',
    "        }",
    "      ]",
    "    }",
    "  ]",
    '  "generationMode": "ai",',
    '  "aiProvider": "openai"',
    "}",
    "Rules:",
    "- entity.name must be lowercase snake_case, plural is OK",
    "- field.name must be lowercase snake_case",
    "- choose sensible types; enums must include enumValues",
    "- keep it small: 1-3 entities unless prompt demands more",
  ].join("\n");

  const res = await client.responses.create({
    model,
    instructions,
    input: prompt,
  });

  const text = stripCodeFences((res as any)?.output_text || "");
  const plan = safeJsonParse<AppPlan>(text);

  if (!plan || !validatePlanShape(plan)) {
    throw new Error("OpenAI returned invalid plan JSON");
  }

  // enforce provider metadata
  return {
    ...plan,
    generationMode: "ai",
    aiProvider: "openai",
  } as any;
}