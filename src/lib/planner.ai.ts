import type { AppPlan, GenerationMode } from "./types";
import { makePlan } from "./planner"; // ✅ FIX: use planner.ts (not templates)
import { makePlanWithOpenAI } from "./planner.openai";
import path from "path";
import fs from "fs";

function canUseOpenAI() {
  return !!process.env.OPENAI_API_KEY;
}
function canUseGemini() {
  return !!process.env.GEMINI_API_KEY;
}

function withMeta(plan: AppPlan, generationMode: "ai" | "local" | "fallback", aiProvider?: "gemini" | "openai") {
  return {
    ...(plan as unknown as Record<string, unknown>),
    generationMode,
    aiProvider,
  } as AppPlan;
}

function geminiModuleExists() {
  // Build-safe check: only attempt dynamic import if file exists
  const base = path.join(process.cwd(), "src", "lib");
  return fs.existsSync(path.join(base, "planner.gemini.ts")) || fs.existsSync(path.join(base, "planner.gemini.js"));
}

async function tryGemini(prompt: string, modeRequested: GenerationMode, log?: (m: string) => void) {
  if (!canUseGemini()) {
    log?.("Planner: Gemini not configured (missing GEMINI_API_KEY)");
    return null;
  }
  if (!geminiModuleExists()) {
    log?.("Planner: Gemini module not present (planner.gemini.ts missing) — skipping");
    return null;
  }

  try {
    log?.("Planner: trying Gemini…");
    const mod = (await import("./planner.gemini")) as unknown as {
      makePlanWithGemini: (p: string, m: GenerationMode) => Promise<AppPlan>;
    };
    const plan = await mod.makePlanWithGemini(prompt, modeRequested);
    return withMeta(plan, "ai", "gemini");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log?.(`Planner: Gemini failed → ${msg}`);
    return null;
  }
}

async function tryOpenAI(prompt: string, modeRequested: GenerationMode, log?: (m: string) => void) {
  if (!canUseOpenAI()) {
    log?.("Planner: OpenAI not configured (missing OPENAI_API_KEY)");
    return null;
  }

  try {
    log?.("Planner: trying OpenAI backup…");
    const plan = await makePlanWithOpenAI(prompt, modeRequested);
    return withMeta(plan, "ai", "openai");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log?.(`Planner: OpenAI failed → ${msg}`);
    return null;
  }
}

export async function makePlanWithAI(
  prompt: string,
  modeRequested: GenerationMode,
  log?: (m: string) => void
): Promise<AppPlan> {
  if (modeRequested === "local") {
    log?.("Planner: mode=local → using local planner");
    return withMeta(makePlan(prompt), "local");
  }

  const gem = await tryGemini(prompt, modeRequested, log);
  if (gem) return gem;

  const oa = await tryOpenAI(prompt, modeRequested, log);
  if (oa) return oa;

  log?.("Planner: all AI paths unavailable/failed → fallback to local planner");
  return withMeta(makePlan(prompt), "fallback");
}