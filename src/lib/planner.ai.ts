import type { AppPlan, GenerationMode } from "./types";
import { makePlan } from "./templates";
import { makePlanWithOpenAI } from "./planner.openai";

type Provider = "gemini" | "openai" | "local" | "fallback";

function canUseOpenAI() {
  return !!process.env.OPENAI_API_KEY;
}
function canUseGemini() {
  return !!process.env.GEMINI_API_KEY;
}

function withMeta(plan: AppPlan, generationMode: "ai" | "local" | "fallback", aiProvider?: "gemini" | "openai") {
  return {
    ...(plan as any),
    generationMode,
    aiProvider,
  } as any as AppPlan;
}

async function tryGemini(prompt: string, modeRequested: GenerationMode, log?: (m: string) => void) {
  if (!canUseGemini()) {
    log?.("Planner: Gemini not configured (missing GEMINI_API_KEY)");
    return null;
  }

  try {
    log?.("Planner: trying Gemini…");

    // Dynamic import so missing file doesn't crash build.
    // Supports either planner.gemini.ts or planner.gemini.js if you add it later.
    const mod = await import("./planner.gemini").catch(() => null as any);
    if (!mod?.makePlanWithGemini) {
      log?.("Planner: Gemini module missing (src/lib/planner.gemini.ts not found) — skipping");
      return null;
    }

    const plan = (await mod.makePlanWithGemini(prompt, modeRequested)) as AppPlan;
    return withMeta(plan, "ai", "gemini");
  } catch (e: any) {
    log?.(`Planner: Gemini failed → ${e?.message || e}`);
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
  } catch (e: any) {
    log?.(`Planner: OpenAI failed → ${e?.message || e}`);
    return null;
  }
}

/**
 * Orchestrator:
 * - mode=local => local
 * - else: try Gemini if available AND module exists
 * - else: try OpenAI if available
 * - else: local fallback
 */
export async function makePlanWithAI(
  prompt: string,
  modeRequested: GenerationMode,
  log?: (m: string) => void
): Promise<AppPlan> {
  if (modeRequested === "local") {
    log?.("Planner: mode=local → using local templates");
    return withMeta(makePlan(prompt), "local");
  }

  const gem = await tryGemini(prompt, modeRequested, log);
  if (gem) return gem;

  const oa = await tryOpenAI(prompt, modeRequested, log);
  if (oa) return oa;

  log?.("Planner: all AI paths unavailable/failed → falling back to local templates");
  return withMeta(makePlan(prompt), "fallback");
}