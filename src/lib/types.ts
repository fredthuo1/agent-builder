export type GenerationMode = "auto" | "ai" | "local";

export type PlannerMode = "ai" | "local" | "fallback";

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "text";

export type FieldSpec = {
  name: string;
  type: FieldType;
  required?: boolean;
  enumValues?: string[];
};

export type EntitySpec = {
  name: string; // singular: "task"
  title?: string; // display name: "Tasks"
  fields: FieldSpec[];
};

export type AppPlan = {
  appName: string;
  entities: Array<{
    name: string;
    title?: string;
    fields: Array<{
      name: string;
      type: "string" | "text" | "number" | "boolean" | "date" | "enum";
      required?: boolean;
      enumValues?: string[];
    }>;
  }>;

  // Added metadata (used for logs/UI)
  generationMode?: "ai" | "local" | "fallback";
  aiProvider?: "gemini" | "openai";
};

export type AgentName = "planner" | "backend" | "frontend" | "qa";

export type AgentStatus = "queued" | "running" | "done" | "failed";

export type AgentState = {
  name: AgentName;
  status: AgentStatus;
  log: string[];
  output?: any;
};

export type BuildStatus = "queued" | "running" | "done" | "failed";

export type BuildState = {
  id: string;
  status: BuildStatus;
  prompt: string;
  modeRequested: GenerationMode;
  outDir: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
  agents: Record<AgentName, AgentState>;
};