import fs from "fs/promises";
import path from "path";
import { getBuild } from "@/lib/builds";

const MAX_BYTES = 800_000; // 0.8MB preview limit

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const buildId = String(searchParams.get("buildId") || "");
  const relPath = String(searchParams.get("path") || "");

  if (!buildId || !relPath) return Response.json({ error: "Missing params" }, { status: 400 });

  const build = await getBuild(buildId);
  if (!build) return Response.json({ error: "Unknown buildId" }, { status: 404 });

  // prevent traversal
  const full = path.join(build.outDir, relPath);
  const resolved = path.resolve(full);
  const rootResolved = path.resolve(build.outDir);
  if (!resolved.startsWith(rootResolved)) return Response.json({ error: "Invalid path" }, { status: 400 });

  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat || !stat.isFile()) return Response.json({ error: "Not a file" }, { status: 404 });

  if (stat.size > MAX_BYTES) {
    return Response.json({ error: `File too large to preview (${stat.size} bytes)` }, { status: 413 });
  }

  const content = await fs.readFile(resolved, "utf8");
  return Response.json({ content });
}