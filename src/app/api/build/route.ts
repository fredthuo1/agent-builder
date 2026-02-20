import { NextResponse } from "next/server";
import crypto from "crypto";
import { initBuild } from "@/lib/builds";
import { runBuild } from "@/lib/runner";
import type { GenerationMode } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || "").trim();
    if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

    // mode can be: "auto" | "ai" | "local"
    const mode = (String(body?.mode || "auto") as GenerationMode) || "auto";

    const buildId = crypto.randomBytes(6).toString("base64url");
    const state = await initBuild(buildId, prompt);

    void runBuild(buildId, prompt, state.outDir, mode);

    return NextResponse.json({ buildId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}