import { NextResponse } from "next/server";
import { getBuild, listGeneratedFiles } from "@/lib/builds";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const buildId = String(searchParams.get("buildId") || "").trim();
  if (!buildId) return NextResponse.json({ error: "Missing buildId" }, { status: 400 });

  const build = await getBuild(buildId);
  if (!build) return NextResponse.json({ error: "Unknown buildId" }, { status: 404 });

  const files = await listGeneratedFiles(buildId);

  return NextResponse.json({ build, files });
}