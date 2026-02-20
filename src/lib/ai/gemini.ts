import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type { AppPlan, GenerationMode, PlannerMode } from "./types";
import { makeLocalPlan } from "./planner.local";

const FieldSpecZ = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "date", "enum", "text"]),
  required: z.boolean().optional(),
  enumValues: z.array(z.string().min(1)).optional(),
});

const EntitySpecZ = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  fields: z.array(FieldSpecZ).min(1),
});

const AppPlanZ = z.object({
  appName: z.string().min(1),
  description: z.string().optional(),
  generationMode: z.enum(["ai", "local", "fallback"]),
  entities: z.array(EntitySpecZ).min(1),
});

function stripCodeFences(s: string) {
  return s.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
}

export async function makePlanWithGemini(prompt: string, modeRequested: GenerationMode): Promise<AppPlan> {
  const apiKey = process.env.GEMINI_API_KEY;

  // hard rules:
  // - if user requests local => local
  // - if no key => local
  if (modeRequested === "local" || !apiKey) {
    return makeLocalPlan(prompt, "local");
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const system = `
You are a senior software planner. Output ONLY valid JSON.
Create an app generation plan. Requirements:
- Return JSON matching this shape:
{
  "appName": string,
  "description": string (optional),
  "generationMode": "ai",
  "entities": [
    {
      "name": string (snake_case singular, e.g. "task"),
      "title": string (optional, e.g. "Tasks"),
      "fields": [
        { "name": string (snake_case), "type": "string|number|boolean|date|enum|text", "required": boolean?, "enumValues": string[]? }
      ]
    }
  ]
}
Rules:
- Do NOT include "id" in fields. Backend will add id automatically.
- Prefer "text" for long notes.
- Use "enum" with enumValues when prompt lists choices.
- Keep entity list small and focused (1-3).
`;

  const user = `
Prompt:
${prompt}
`;

  const tryOnce = async (): Promise<AppPlan> => {
    const resp = await model.generateContent([
      { role: "user", parts: [{ text: system + "\n\n" + user }] },
    ]);

    const text = resp.response.text();
    const raw = stripCodeFences(text);

    const parsed = JSON.parse(raw);
    const validated = AppPlanZ.parse(parsed);

    // enforce AI mode
    return { ...validated, generationMode: "ai" };
  };

  try {
    return await tryOnce();
  } catch {
    // retry once with stricter “ONLY JSON”
    try {
      const resp = await model.generateContent([
        {
          role: "user",
          parts: [
            {
              text:
                system +
                "\n\nReturn ONLY minified JSON. No markdown. No commentary.\n\n" +
                user,
            },
          ],
        },
      ]);
      const raw = stripCodeFences(resp.response.text());
      const parsed = JSON.parse(raw);
      const validated = AppPlanZ.parse(parsed);
      return { ...validated, generationMode: "ai" };
    } catch {
      // final fallback
      return makeLocalPlan(prompt, "fallback" satisfies PlannerMode);
    }
  }
}