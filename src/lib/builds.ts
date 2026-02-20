import fs from "fs/promises";
import path from "path";

export const GENERATED_ROOT = path.join(process.cwd(), "generated");

// Persist map across hot reloads in dev
type AgentName = "planner" | "backend" | "frontend" | "qa";
type AgentStatus = "idle" | "running" | "done" | "failed";
type BuildStatus = "running" | "done" | "failed";

export type BuildAgent = {
  name: AgentName;
  status: AgentStatus;
  log: string[];
  output?: any;
};

export type BuildState = {
  id: string;
  prompt: string;
  createdAt: number;
  status: BuildStatus;
  error?: string;
  agents: Record<AgentName, BuildAgent>;
  outDir: string; // absolute
};

const g = globalThis as any;
const builds: Map<string, BuildState> = (g.__AGENT_BUILDER_BUILDS__ ||= new Map<string, BuildState>());

function buildDir(id: string) {
  return path.join(GENERATED_ROOT, id);
}
function statusPath(id: string) {
  return path.join(buildDir(id), "status.json");
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function persist(build: BuildState) {
  await ensureDir(buildDir(build.id));
  await fs.writeFile(statusPath(build.id), JSON.stringify(build, null, 2), "utf8");
}

async function loadFromDisk(id: string): Promise<BuildState | null> {
  try {
    const raw = await fs.readFile(statusPath(id), "utf8");
    return JSON.parse(raw) as BuildState;
  } catch {
    return null;
  }
}

export async function initBuild(id: string, prompt: string) {
  await ensureDir(GENERATED_ROOT);
  const outDir = path.join(buildDir(id), "project"); // where files go

  const state: BuildState = {
    id,
    prompt,
    createdAt: Date.now(),
    status: "running",
    outDir,
    agents: {
      planner: { name: "planner", status: "idle", log: [] },
      backend: { name: "backend", status: "idle", log: [] },
      frontend: { name: "frontend", status: "idle", log: [] },
      qa: { name: "qa", status: "idle", log: [] },
    },
  };

  builds.set(id, state);
  await persist(state);
  return state;
}

export async function getBuild(id: string): Promise<BuildState | null> {
  const mem = builds.get(id);
  if (mem) return mem;

  // hot-reload recovery
  const disk = await loadFromDisk(id);
  if (disk) {
    builds.set(id, disk);
    return disk;
  }
  return null;
}

export async function setAgentStatus(id: string, agent: AgentName, status: AgentStatus, extra?: { output?: any }) {
  const b = await getBuild(id);
  if (!b) return;

  b.agents[agent].status = status;
  if (extra?.output !== undefined) b.agents[agent].output = extra.output;

  builds.set(id, b);
  await persist(b);
}

export async function appendLog(id: string, agent: AgentName, line: string) {
  const b = await getBuild(id);
  if (!b) return;

  b.agents[agent].log.push(line);
  // keep logs bounded
  if (b.agents[agent].log.length > 500) b.agents[agent].log = b.agents[agent].log.slice(-500);

  builds.set(id, b);
  await persist(b);
}

export async function setBuildDone(id: string) {
  const b = await getBuild(id);
  if (!b) return;

  b.status = "done";
  builds.set(id, b);
  await persist(b);
}

export async function setBuildFailed(id: string, error: string) {
  const b = await getBuild(id);
  if (!b) return;

  b.status = "failed";
  b.error = error;
  builds.set(id, b);
  await persist(b);
}

export async function listGeneratedFiles(id: string): Promise<string[]> {
  const b = await getBuild(id);
  if (!b) return [];

  const root = b.outDir;

  async function walk(dir: string): Promise<string[]> {
    let entries: any[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    const out: string[] = [];
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        out.push(...(await walk(full)));
      } else if (ent.isFile()) {
        out.push(path.relative(root, full).replace(/\\/g, "/"));
      }
    }
    return out;
  }

  return walk(root);
}