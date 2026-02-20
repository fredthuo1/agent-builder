import { appendLog } from "./builds";

export type GenerationMode = "ai" | "local" | "fallback";

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "enum";

export type EntityField = {
  name: string;
  type: FieldType;
  required?: boolean;
  enumValues?: string[];
};

export type EntitySpec = {
  name: string; // e.g. "tasks"
  label?: string; // e.g. "Tasks"
  fields: EntityField[];
};

export type AppPlan = {
  appName: string;
  description: string;
  generationMode: GenerationMode;
  entities: EntitySpec[];
};

function titleCase(s: string) {
  return s
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function safeEntityName(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "items";
}

function normalizePlan(input: any): AppPlan {
  const appName = String(input?.appName || "Generated App").slice(0, 60);
  const description = String(input?.description || "Generated full-stack CRUD app.");
  const entitiesRaw = Array.isArray(input?.entities) ? input.entities : [];

  const entities: EntitySpec[] = entitiesRaw.length
    ? entitiesRaw.map((e: any) => {
        const name = safeEntityName(String(e?.name || "items"));
        const label = String(e?.label || titleCase(name));

        const fieldsRaw = Array.isArray(e?.fields) ? e.fields : [];
        const fields: EntityField[] = fieldsRaw
          .map((f: any) => {
            const fname = safeEntityName(String(f?.name || ""));
            const t = String(f?.type || "string").toLowerCase();
            const type: FieldType =
              t === "number" ? "number" :
              t === "boolean" ? "boolean" :
              t === "date" ? "date" :
              t === "enum" ? "enum" :
              "string";

            const enumValues = Array.isArray(f?.enumValues)
              ? f.enumValues.map(String).filter(Boolean).slice(0, 50)
              : undefined;

            return {
              name: fname,
              type,
              required: !!f?.required,
              enumValues: type === "enum" ? (enumValues?.length ? enumValues : ["OptionA", "OptionB"]) : undefined,
            };
          })
          .filter((f: EntityField) => f.name && f.name !== "id");

        // Always guarantee at least 2 fields
        if (fields.length === 0) {
          fields.push({ name: "title", type: "string", required: true });
          fields.push({ name: "status", type: "enum", enumValues: ["todo", "doing", "done"] });
        }

        return { name, label, fields };
      })
    : [
        {
          name: "items",
          label: "Items",
          fields: [
            { name: "title", type: "string", required: true },
            { name: "status", type: "enum", enumValues: ["todo", "doing", "done"] },
          ],
        },
      ];

  return {
    appName,
    description,
    generationMode: "local",
    entities,
  };
}

function localPlanFromPrompt(prompt: string): AppPlan {
  // Simple deterministic extraction:
  // - Try to find "fields:" and parse comma-separated tokens with optional types.
  // - Otherwise create a decent default spec.
  const p = prompt || "";
  const appName =
    (p.match(/app\s+called\s+["']([^"']+)["']/i)?.[1] ||
      p.match(/build\s+a[n]?\s+(.+?)(?:\s+with|\.)/i)?.[1] ||
      "Generated CRUD App"
    ).slice(0, 60);

  const fieldsPart =
    p.match(/fields?\s*:\s*([\s\S]+)/i)?.[1] ||
    p.match(/with\s+fields?\s*:\s*([\s\S]+)/i)?.[1] ||
    "";

  const entityName =
    p.match(/for\s+(\w+)/i)?.[1] ||
    p.match(/tracker\s+for\s+(\w+)/i)?.[1] ||
    "items";

  const fields: EntityField[] = [];
  if (fieldsPart) {
    const tokens = fieldsPart
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 25);

    for (const t of tokens) {
      // patterns:
      // "name", "streak (number)", "status (open, closed)", "active (boolean)"
      const m = t.match(/^([a-zA-Z0-9_-]+)(?:\s*\(([^)]+)\))?$/);
      if (!m) continue;
      const rawName = m[1]!;
      const meta = (m[2] || "").trim();

      const name = safeEntityName(rawName);
      if (!name || name === "id") continue;

      let type: FieldType = "string";
      let enumValues: string[] | undefined;

      const metaLower = meta.toLowerCase();
      if (metaLower.includes("number") || metaLower.includes("int") || metaLower.includes("float")) type = "number";
      else if (metaLower.includes("bool")) type = "boolean";
      else if (metaLower.includes("date")) type = "date";
      else if (meta && meta.includes(",")) {
        type = "enum";
        enumValues = meta.split(",").map((x) => x.trim()).filter(Boolean);
      } else if (metaLower === "enum") {
        type = "enum";
        enumValues = ["OptionA", "OptionB"];
      }

      fields.push({ name, type, enumValues });
    }
  }

  const entity = {
    name: safeEntityName(entityName),
    label: titleCase(entityName),
    fields: fields.length
      ? fields
      : [
          { name: "title", type: "string", required: true },
          { name: "status", type: "enum", enumValues: ["todo", "doing", "done"] },
        ],
  };

  return {
    appName: titleCase(appName),
    description: "Generated full-stack CRUD app.",
    generationMode: "local",
    entities: [entity],
  };
}

async function tryGeminiPlan(buildId: string, prompt: string): Promise<AppPlan | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const apiUrl =
    process.env.GEMINI_API_URL ||
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

  if (!apiKey) return null;

  // We demand strict JSON with a defined shape.
  const system = `You are a planner. Return ONLY valid JSON. No markdown.
Schema:
{
  "appName": string,
  "description": string,
  "entities": [
    {
      "name": "snake_case_plural",
      "label": "Human Label",
      "fields": [
        { "name": "snake_case", "type": "string|number|boolean|date|enum", "required": boolean, "enumValues": string[] }
      ]
    }
  ]
}
Rules:
- Include at least 1 entity.
- Include 2-12 fields per entity.
- Use "enum" with enumValues when user lists choices.
- Do NOT include id (it is implicit).
`;

  const body = {
    contents: [
      { role: "user", parts: [{ text: `${system}\n\nUser prompt:\n${prompt}` }] },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1200,
    },
  };

  try {
    await appendLog(buildId, "planner", "AI mode enabled: requesting plan from Gemini…");
    const r = await fetch(`${apiUrl}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const j: any = await r.json();
    const text =
      j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ||
      "";

    if (!text) {
      await appendLog(buildId, "planner", "Gemini returned empty output.");
      return null;
    }

    // Extract JSON (in case Gemini wraps it accidentally)
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonStr = start >= 0 && end > start ? text.slice(start, end + 1) : text;

    const parsed = JSON.parse(jsonStr);
    const plan = normalizePlan(parsed);
    plan.generationMode = "ai";
    await appendLog(buildId, "planner", "Gemini plan parsed successfully ✅");
    return plan;
  } catch (e: any) {
    await appendLog(buildId, "planner", `Gemini planning failed: ${e?.message || String(e)}`);
    return null;
  }
}

export async function makePlan(buildId: string, prompt: string, mode: "auto" | "ai" | "local") {
  // AI / AUTO can try Gemini, but must always fall back.
  if (mode === "ai" || mode === "auto") {
    const ai = await tryGeminiPlan(buildId, prompt);
    if (ai) return ai;

    // If AI was requested but failed, mark fallback explicitly.
    const fallback = localPlanFromPrompt(prompt);
    fallback.generationMode = mode === "ai" ? "fallback" : "local";
    await appendLog(buildId, "planner", `Using ${fallback.generationMode.toUpperCase()} planner.`);
    return fallback;
  }

  const local = localPlanFromPrompt(prompt);
  local.generationMode = "local";
  await appendLog(buildId, "planner", "Using LOCAL planner.");
  return local;
}