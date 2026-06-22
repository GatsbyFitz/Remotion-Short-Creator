import fs from "node:fs";
import path from "node:path";
import { CanvasSink, FilePathSource, Input, MP4 } from "mediabunny";
import { ensureMediabunnyServer } from "@/lib/mediabunny-server";

export async function generateFrames(project: string) {
  "use step";

  ensureMediabunnyServer();

  const projectDir = path.join(process.cwd(), "public", "projects", project);
  const videoFile =
    fs.readdirSync(projectDir).find(
      (f) =>
        f.toLowerCase() === "video-normalized.mp4" ||
        (!f.startsWith("._") && f.toLowerCase().endsWith(".mp4") && f.toLowerCase() !== "audio.mp4")
    );

  if (!videoFile) throw new Error("No source mp4 found");

  const framesDir = path.join(projectDir, "frames");
  const manifestPath = path.join(projectDir, "frames-manifest.json");
  fs.mkdirSync(framesDir, { recursive: true });

  for (const f of fs.readdirSync(framesDir)) {
    if (f.toLowerCase().endsWith(".jpg")) fs.unlinkSync(path.join(framesDir, f));
  }

  const input = new Input({
    source: new FilePathSource(path.join(projectDir, videoFile)),
    formats: [MP4],
  });

  const duration = Math.floor(await input.computeDuration());
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) throw new Error("No primary video track");

  const canDecode = await videoTrack.canDecode();
  const codec = await videoTrack.getCodec();
  if (!canDecode) {
    throw new Error(
      `Video codec is not decodable in this runtime (codec: ${codec ?? "unknown"}). Please upload H.264 MP4.`,
    );
  }

  const sink = new CanvasSink(videoTrack, { width: 640, fit: "contain", alpha: false });
  const timestamps = Array.from({ length: duration + 1 }, (_, i) => i);

  const frames: Array<{
    fileName: string;
    absolutePath: string;
    relativePath: string;
    second: number;
  }> = [];

  let i = 0;
  for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
    const second = timestamps[i] ?? i;
    i += 1;
    if (!wrapped) continue;

    const fileName = `frame-${String(second).padStart(6, "0")}.jpg`;
    const absolutePath = path.join(framesDir, fileName);

    if ("convertToBlob" in wrapped.canvas && typeof wrapped.canvas.convertToBlob === "function") {
      const blob = await wrapped.canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
      fs.writeFileSync(absolutePath, new Uint8Array(await blob.arrayBuffer()));
    } else if ("toBlob" in wrapped.canvas && typeof wrapped.canvas.toBlob === "function") {
      const htmlCanvas = wrapped.canvas as HTMLCanvasElement;
      await new Promise<void>((resolve, reject) => {
        htmlCanvas.toBlob(async (blob: Blob | null) => {
          if (!blob) return reject(new Error("toBlob failed"));
          fs.writeFileSync(absolutePath, new Uint8Array(await blob.arrayBuffer()));
          resolve();
        }, "image/jpeg", 0.82);
      });
    } else {
      throw new Error("No canvas blob encoder available");
    }

    frames.push({
      fileName,
      absolutePath,
      relativePath: `/projects/${project}/frames/${fileName}`,
      second,
    });
  }

  const result = {
    project,
    fps: 1,
    frameCount: frames.length,
    framesDir,
    manifestPath,
    frames,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(result, null, 2), "utf-8");
  return result;
}