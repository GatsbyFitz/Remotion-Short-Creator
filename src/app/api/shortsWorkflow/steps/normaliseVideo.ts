import fs from "node:fs";
import path from "node:path";
import {
  Conversion,
  FilePathSource,
  FilePathTarget,
  Input,
  MP4,
  Mp4OutputFormat,
  Output,
} from "mediabunny";
import { ensureMediabunnyServer } from "@/lib/mediabunny-server";

export async function normaliseVideo(project: string) {
  "use step";

  ensureMediabunnyServer();

  const projectDir = path.join(process.cwd(), "public", "projects", project);

  const sourceFile = fs
    .readdirSync(projectDir)
    .find(
      (f) =>
        !f.startsWith("._") &&
        f.toLowerCase().endsWith(".mp4") &&
        f.toLowerCase() !== "audio.mp4" &&
        f.toLowerCase() !== "video-normalized.mp4",
    );

  if (!sourceFile) {
    throw new Error("No source mp4 found");
  }

  const sourcePath = path.join(projectDir, sourceFile);
  const normalizedPath = path.join(projectDir, "video-normalized.mp4");
  const tempPath = path.join(projectDir, "video-normalized.tmp.mp4");

  const input = new Input({
    source: new FilePathSource(sourcePath),
    formats: [MP4],
  });

  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) {
    throw new Error("No primary video track");
  }

  // Diagnostic block: helps distinguish backend missing vs stream unsupported
  const canDecode = await videoTrack.canDecode();
  const codec = await videoTrack.getCodec();

  const runtimeInfo = {
    project,
    sourceFile,
    sourcePath,
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cwd: process.cwd(),
    canDecode,
    codec: codec ?? "unknown",
  };

  console.log("[normaliseVideo] decode diagnostics", runtimeInfo);

  if (!canDecode) {
    throw new Error(
      `Video codec is not decodable in this runtime (codec: ${codec ?? "unknown"}). Please upload H.264 MP4.`,
    );
  }

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new FilePathTarget(tempPath),
  });

  const conversion = await Conversion.init({
    input,
    output,
    video: {
      codec: "avc",
      forceTranscode: true,
    },
    audio: {
      codec: "aac",
      forceTranscode: true,
    },
  });

  await conversion.execute();

  if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size === 0) {
    throw new Error("Normalization failed: output file is missing or empty.");
  }

  if (fs.existsSync(normalizedPath)) {
    fs.unlinkSync(normalizedPath);
  }
  fs.renameSync(tempPath, normalizedPath);

  return {
    normalizedFileName: "video-normalized.mp4",
    normalizedPath,
    sourceFileName: sourceFile,
  };
}