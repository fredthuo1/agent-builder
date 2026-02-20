import archiver from "archiver";
import { getBuild } from "@/lib/builds";
import { createReadStream } from "fs";
import path from "path";
import fs from "fs/promises";

/**
 * Convert a Node.js Readable into a Web ReadableStream.
 * Works in Next.js route handlers (Node runtime).
 */
function nodeReadableToWeb(readable: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      readable.on("data", (chunk: any) => controller.enqueue(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)));
      readable.on("end", () => controller.close());
      readable.on("error", (err) => controller.error(err));
    },
    cancel() {
      // best-effort cleanup
      try {
        // @ts-ignore
        readable.destroy?.();
      } catch {}
    },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const buildId = String(searchParams.get("buildId") || "").trim();
    if (!buildId) return new Response("Missing buildId", { status: 400 });

    const build = await getBuild(buildId);
    if (!build) return new Response("Unknown buildId", { status: 404 });

    // Ensure build output exists
    const st = await fs.stat(build.outDir).catch(() => null);
    if (!st || !st.isDirectory()) return new Response("Build output not found", { status: 404 });

    const zipName = `${buildId}.zip`;

    // Create an archiver instance and pipe to a Node stream we can adapt.
    // Use a temp file to avoid Node stream interop edge cases in Next.
    const tmpDir = path.join(build.outDir, ".."); // generated/<id>
    const tmpZip = path.join(tmpDir, `${buildId}.tmp.zip`);

    // Remove previous temp zip if present
    await fs.rm(tmpZip, { force: true }).catch(() => {});

    const output = (await import("fs")).createWriteStream(tmpZip);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("warning", (err: any) => {
      // log warnings but don't crash export
      console.warn("archive warning:", err);
    });

    const done = new Promise<void>((resolve, reject) => {
      output.on("close", () => resolve());
      output.on("error", reject);
      archive.on("error", reject);
    });

    archive.pipe(output);

    // Add all build files but skip heavy dirs
    archive.glob("**/*", {
      cwd: build.outDir,
      dot: true,
      ignore: ["**/node_modules/**", "**/.next/**", "**/.git/**", "**/backend/data/**"],
    });

    await archive.finalize();
    await done;

    // Stream the temp zip to the client
    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Disposition", `attachment; filename="${zipName}"`);
    headers.set("Cache-Control", "no-store");

    const nodeStream = createReadStream(tmpZip);
    const webStream = nodeReadableToWeb(nodeStream);

    return new Response(webStream, { headers });
  } catch (e: any) {
    console.error("Export failed:", e);
    return new Response(`Export failed: ${e?.message || e}`, { status: 500 });
  }
}