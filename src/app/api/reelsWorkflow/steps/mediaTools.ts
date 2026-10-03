import { execFile } from "node:child_process";
import fs from "fs";
import path from "node:path";
import { promisify } from "node:util";
import { ALL_FORMATS, FilePathSource, Input } from "mediabunny";

// Media conversion for reel imports. macOS-only by design, like the Photos
// import itself: sips and avconvert ship with the OS, and avconvert is Apple's
// own exporter, so iPhone HEVC and HDR clips come out as SDR H.264 that the
// Remotion renderer can decode.

const run = promisify(execFile);

export const PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif", ".tif", ".tiff", ".webp"]);
export const VIDEO_EXTENSIONS = new Set([".mov", ".mp4", ".m4v"]);

// Comfortably above the 1920px reel height, with headroom for zooms and pans.
const PHOTO_MAX_EDGE = 2560;
const THUMB_MAX_EDGE = 768;

// Only this much of a long video is converted. Album clips are usually short;
// a long recording is trimmed rather than holding up the whole import.
const VIDEO_MAX_SECONDS = 180;

// Up to this many frames per video for the analysis pass.
const FRAMES_PER_VIDEO = 3;

const ffmpegPath = (): string => {
  // Resolved lazily so a missing binary only fails the step that needs it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("@ffmpeg-installer/ffmpeg") as { path: string }).path;
};

export const mediaKind = (file: string): "photo" | "video" | null => {
  const ext = path.extname(file).toLowerCase();
  if (PHOTO_EXTENSIONS.has(ext)) return "photo";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return null;
};

const readPhotoInfo = async (file: string) => {
  const { stdout } = await run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", "-g", "orientation", file]);
  const value = (key: string) => stdout.match(new RegExp(`${key}: (\\S+)`))?.[1];
  const width = Number(value("pixelWidth"));
  const height = Number(value("pixelHeight"));
  const orientation = Number(value("orientation"));

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Couldn't read dimensions of ${path.basename(file)}`);
  }

  // EXIF orientations 5-8 are rotated a quarter turn: the pixels are stored
  // sideways and the browser turns them upright when it displays them.
  const sideways = orientation >= 5 && orientation <= 8;
  return { width, height, displayWidth: sideways ? height : width, displayHeight: sideways ? width : height };
};

// Re-encodes to JPEG (the renderer's browser can't show HEIC) and only ever
// scales down.
const toJpeg = async (source: string, dest: string, maxEdge: number) => {
  const info = await readPhotoInfo(source);
  const resize = Math.max(info.width, info.height) > maxEdge ? ["-Z", String(maxEdge)] : [];
  await run("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "85", ...resize, source, "--out", dest]);
};

export const importPhoto = async (source: string, destDir: string, thumbsDir: string, id: string) => {
  const file = path.join(destDir, `${id}.jpg`);
  await toJpeg(source, file, PHOTO_MAX_EDGE);
  const thumb = path.join(thumbsDir, `${id}.jpg`);
  await toJpeg(file, thumb, THUMB_MAX_EDGE);

  const info = await readPhotoInfo(file);
  return { file, width: info.displayWidth, height: info.displayHeight, thumbs: [{ file: thumb }] };
};

const probeVideo = async (file: string) => {
  const input = new Input({ formats: ALL_FORMATS, source: new FilePathSource(file) });

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      throw new Error(`No video track in ${path.basename(file)}`);
    }
    return {
      width: track.displayWidth,
      height: track.displayHeight,
      duration: await input.computeDuration(),
    };
  } finally {
    input.dispose();
  }
};

export const importVideo = async (source: string, destDir: string, thumbsDir: string, id: string) => {
  const file = path.join(destDir, `${id}.mp4`);

  // Preset1920x1080 fits within 1920x1080 in the clip's own orientation and
  // always writes SDR H.264, tone-mapping HDR along the way.
  await run(
    "avconvert",
    ["--source", source, "--preset", "Preset1920x1080", "--output", file, "--duration", String(VIDEO_MAX_SECONDS), "--replace"],
    { maxBuffer: 16 * 1024 * 1024 },
  );

  const info = await probeVideo(file);

  // Frames from the middle of each third, so very short clips still get
  // distinct frames rather than the same one repeated.
  const frameCount = info.duration < 2 ? 1 : FRAMES_PER_VIDEO;
  const thumbs: Array<{ file: string; second: number }> = [];

  for (let i = 0; i < frameCount; i += 1) {
    const second = Math.round(((i + 0.5) / frameCount) * info.duration * 10) / 10;
    const thumb = path.join(thumbsDir, `${id}-${i}.jpg`);
    await run(ffmpegPath(), [
      "-y",
      "-loglevel",
      "error",
      "-ss",
      String(second),
      "-i",
      file,
      "-frames:v",
      "1",
      "-vf",
      `scale='if(gt(iw,ih),${THUMB_MAX_EDGE},-2)':'if(gt(iw,ih),-2,${THUMB_MAX_EDGE})'`,
      "-q:v",
      "3",
      thumb,
    ]);
    if (fs.existsSync(thumb)) {
      thumbs.push({ file: thumb, second });
    }
  }

  return { file, width: info.width, height: info.height, duration: info.duration, thumbs };
};
