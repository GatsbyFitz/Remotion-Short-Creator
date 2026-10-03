import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "fs";
import path from "node:path";
import { promisify } from "node:util";
import { PhotosAccessError } from "./photosAlbum";

const run = promisify(execFile);

// Photos' AppleScript `export` silently writes nothing on current macOS, so
// files come out through PhotoKit instead, via a small helper app built from
// scripts/photos-helper/main.swift. It's an app rather than a plain binary so
// macOS asks for Photos access in its own name (see main.swift).

const APP_NAME = "ReelsPhotosHelper";

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>local.remotion-reels.photos-helper</string>
  <key>CFBundleName</key><string>Reels Photos Helper</string>
  <key>CFBundleExecutable</key><string>${APP_NAME}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSPhotoLibraryUsageDescription</key>
  <string>Exports the photos and clips in the album you chose so the reels workflow can turn them into reels.</string>
</dict>
</plist>
`;

const paths = () => {
  const bin = path.join(process.cwd(), "data", "bin");
  return {
    source: path.join(process.cwd(), "scripts", "photos-helper", "main.swift"),
    app: path.join(bin, `${APP_NAME}.app`),
    // Outside the bundle: anything written inside it after signing breaks the signature.
    stamp: path.join(bin, `${APP_NAME}.source-hash`),
  };
};

// Builds and ad-hoc signs the helper on first use, and again only when its
// source changes. macOS ties the Photos permission to the signature, so a
// rebuild means one fresh permission prompt.
const ensureHelper = async (): Promise<string> => {
  const { source, app, stamp } = paths();
  const hash = crypto.createHash("sha256").update(fs.readFileSync(source, "utf-8")).update(INFO_PLIST).digest("hex");

  if (fs.existsSync(stamp) && fs.readFileSync(stamp, "utf-8") === hash && fs.existsSync(app)) {
    return app;
  }

  console.log("Building the Photos helper app (first run, or its source changed)...");
  fs.rmSync(app, { recursive: true, force: true });
  fs.mkdirSync(path.join(app, "Contents", "MacOS"), { recursive: true });
  fs.writeFileSync(path.join(app, "Contents", "Info.plist"), INFO_PLIST, "utf-8");

  try {
    await run("xcrun", ["swiftc", "-O", source, "-o", path.join(app, "Contents", "MacOS", APP_NAME)], {
      maxBuffer: 16 * 1024 * 1024,
    });
    await run("codesign", ["--force", "--sign", "-", app]);
  } catch (err) {
    const detail = (err as { stderr?: string }).stderr || (err instanceof Error ? err.message : String(err));
    throw new Error(`Couldn't build the Photos helper (needs Xcode or its Command Line Tools): ${detail.trim()}`);
  }

  fs.writeFileSync(stamp, hash, "utf-8");
  return app;
};

// CloudPhotoLibraryErrorDomain errors mean the original is only in iCloud and
// couldn't be downloaded: typically Low Power Mode (which pauses iCloud Photos)
// or too little free space on the disk holding the Photos library.
export const isICloudDownloadError = (message: string) => message.includes("CloudPhotoLibraryErrorDomain");

export const ICLOUD_DOWNLOAD_HINT =
  "only in iCloud and couldn't be downloaded. Turn off Low Power Mode (it pauses iCloud Photos), make sure the Mac's startup disk has a few GB free, then sync again.";

export type PhotosExport = {
  files: Map<string, string>;
  failures: Array<{ id: string; error: string }>;
};

// Exports the given Photos items into outDir and returns the file written for
// each id, plus the reason for each item that couldn't be exported.
export const exportPhotosItems = async (ids: string[], outDir: string): Promise<PhotosExport> => {
  const app = await ensureHelper();
  const requestPath = path.join(outDir, ".photos-request.json");
  const responsePath = path.join(outDir, ".photos-response.json");

  fs.writeFileSync(requestPath, JSON.stringify({ outDir, ids, responsePath }), "utf-8");
  fs.rmSync(responsePath, { force: true });

  // `open -W` waits for the helper to quit; -n starts a fresh instance even if
  // an earlier one is still around.
  await run("open", ["-W", "-n", "-a", app, "--args", requestPath], { timeout: 60 * 60 * 1000 });

  if (!fs.existsSync(responsePath)) {
    throw new Error("The Photos helper exited without reporting back.");
  }

  const response = JSON.parse(fs.readFileSync(responsePath, "utf-8")) as {
    error: string | null;
    items: Array<{ id: string; file?: string; error?: string }>;
  };

  if (response.error === "denied") {
    throw new PhotosAccessError(
      "macOS hasn't given Reels Photos Helper access to your library. Allow it in System Settings → Privacy & Security → Photos (set it to Full Access), then sync again.",
    );
  }

  const files = new Map<string, string>();
  const failures: PhotosExport["failures"] = [];
  for (const item of response.items) {
    if (item.file) {
      files.set(item.id, item.file);
    } else {
      failures.push({ id: item.id, error: item.error ?? "unknown error" });
    }
  }

  const fromICloud = failures.filter((f) => isICloudDownloadError(f.error)).length;
  console.log(
    `Photos export: ${files.size}/${ids.length} items${fromICloud > 0 ? `, ${fromICloud} couldn't be downloaded from iCloud` : ""}.`,
  );
  return { files, failures };
};
