import fs from "fs/promises";
import path from "path";
import { appendLog, setAgentStatus, setBuildDone, setBuildFailed, GENERATED_ROOT } from "./builds";
import type { GenerationMode } from "./types";
import { makePlanWithAI } from "./planner.ai";
import { backendFiles, frontendFiles, rootFiles } from "./templates";

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function rmrf(p: string) {
  await fs.rm(p, { recursive: true, force: true }).catch(() => {});
}

// Write text with Windows-friendly newlines preserved and stable UTF-8
async function writeText(fullPath: string, content: string) {
  await fs.writeFile(fullPath, content, "utf8");
}

async function writeFiles(outDir: string, files: Record<string, string>) {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(outDir, rel);
    await ensureDir(path.dirname(full));
    await writeText(full, content);
  }
}

export async function runBuild(
  buildId: string,
  prompt: string,
  outDir: string,
  modeRequested: GenerationMode = "auto"
) {
  try {
    // ensure generated root exists
    await ensureDir(GENERATED_ROOT);

    // clean previous output for this build id
    await rmrf(outDir);
    await ensureDir(outDir);

    // 🧠 Planner
    await setAgentStatus(buildId, "planner", "running");
    await appendLog(buildId, "planner", `Planning app for: "${prompt}"`);
    await appendLog(buildId, "planner", `Mode requested: ${modeRequested}`);

    const plan = await makePlanWithAI(prompt, modeRequested, (m) => {
      void appendLog(buildId, "planner", m);
    });

    await appendLog(
      buildId,
      "planner",
      `Planner result: generationMode=${(plan as any).generationMode} provider=${(plan as any).aiProvider || "n/a"}`
    );

    await setAgentStatus(buildId, "planner", "done", {
      output: { plan, generationMode: (plan as any).generationMode, aiProvider: (plan as any).aiProvider },
    });

    // 🏗 Backend
    await setAgentStatus(buildId, "backend", "running");
    await appendLog(buildId, "backend", "Generating Express + SQLite backend...");
    await writeFiles(outDir, backendFiles(plan));
    await appendLog(buildId, "backend", "Backend files written ✅");
    await setAgentStatus(buildId, "backend", "done");

    // 🎨 Frontend
    await setAgentStatus(buildId, "frontend", "running");
    await appendLog(buildId, "frontend", "Generating Next.js frontend...");
    await writeFiles(outDir, frontendFiles(plan));
    await appendLog(buildId, "frontend", "Frontend files written ✅");
    await setAgentStatus(buildId, "frontend", "done");

    // 🧪 QA / Root files
    await setAgentStatus(buildId, "qa", "running");
    await appendLog(buildId, "qa", "Writing root package + README + spec.json...");
    await writeFiles(outDir, rootFiles(plan));
    await appendLog(buildId, "qa", "Root files written ✅");
    await appendLog(buildId, "qa", "Build done ✅");
    await setAgentStatus(buildId, "qa", "done");

    await setBuildDone(buildId);
  } catch (e: any) {
    console.error("Build failed:", e);
    await setBuildFailed(buildId, e?.message || "Unknown error");
    await setAgentStatus(buildId, "qa", "failed");
  }
}