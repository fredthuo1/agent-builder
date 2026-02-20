// src/lib/ai/spec.ts

export type FieldType = "text" | "number" | "boolean" | "select" | "date";

export type EntityField = {
  name: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // for select
};

export type AppSpec = {
  appName: string; // slug-like
  displayName: string;
  description: string;
  ports?: { backend: number; frontend: number };
  entity: {
    namePlural: string;   // e.g. "tasks"
    nameSingular: string; // e.g. "task"
    fields: EntityField[];
  };
};

export const APP_SPEC_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["appName", "displayName", "description", "entity"],
  properties: {
    appName: { type: "string", minLength: 1 },
    displayName: { type: "string", minLength: 1 },
    description: { type: "string", minLength: 1 },
    ports: {
      type: "object",
      additionalProperties: false,
      required: ["backend", "frontend"],
      properties: {
        backend: { type: "integer", minimum: 1024, maximum: 65535 },
        frontend: { type: "integer", minimum: 1024, maximum: 65535 },
      },
    },
    entity: {
      type: "object",
      additionalProperties: false,
      required: ["namePlural", "nameSingular", "fields"],
      properties: {
        namePlural: { type: "string", minLength: 1 },
        nameSingular: { type: "string", minLength: 1 },
        fields: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "type"],
            properties: {
              name: { type: "string", minLength: 1 },
              type: { type: "string", enum: ["text", "number", "boolean", "select", "date"] },
              required: { type: "boolean" },
              options: {
                type: "array",
                minItems: 1,
                maxItems: 12,
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export function normalizeSpec(spec: AppSpec): AppSpec {
  const ports = spec.ports ?? { backend: 5050, frontend: 3001 };

  // enforce one required text field if model returns something weird
  const fields = (spec.entity.fields || []).filter(Boolean);
  if (fields.length === 0) {
    fields.push({ name: "title", type: "text", required: true });
  }

  // ensure "select" fields have options
  for (const f of fields) {
    if (f.type === "select" && (!f.options || f.options.length === 0)) {
      f.options = ["OptionA", "OptionB"];
    }
  }

  return {
    ...spec,
    ports,
    entity: {
      ...spec.entity,
      fields,
    },
  };
}
