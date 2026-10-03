import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { reelsWorkflow } from "./workflow";
import { ReelProjectMetadata, ReelSource, reelDir, setStatus } from "./steps/reelsShared";

export const runtime = "nodejs";

// Also guards against path traversal: project ids end up in file paths.
const PROJECT_ID_PATTERN = /^[a-z0-9-]+$/;

type PickedAlbum = { id: string; name: string; path: string[] };

const isPickedAlbum = (value: unknown): value is PickedAlbum => {
  const album = value as Partial<PickedAlbum> | null;
  return (
    typeof album?.id === "string" &&
    album.id.length > 0 &&
    typeof album.name === "string" &&
    Array.isArray(album.path) &&
    album.path.every((p) => typeof p === "string")
  );
};

// POST { album } creates a project from an album chosen in the picker, and
// POST { source } from a typed Photos album name or an absolute folder path;
// both start the full run. POST { projectId, action: "resync" } re-imports an
// existing project's album or folder and re-plans it, and
// POST { projectId, action: "replan" } only re-researches trends and re-plans.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    source?: string;
    album?: unknown;
    projectId?: string;
    action?: string;
  };

  if (body.action === "resync") {
    const projectId = body.projectId;
    if (!projectId || !PROJECT_ID_PATTERN.test(projectId) || !fs.existsSync(path.join(reelDir(projectId), "metadata.json"))) {
      return NextResponse.json({ error: "No reels project with that id." }, { status: 404 });
    }

    // Media seen before comes back from the analysis library, so a re-sync
    // only pays to analyse what's new in the album.
    setStatus(projectId, "importing");
    await start(reelsWorkflow, [projectId, "create"]);
    return NextResponse.json({ success: true, projectId });
  }

  if (body.action === "replan") {
    const projectId = body.projectId;
    if (!projectId || !PROJECT_ID_PATTERN.test(projectId) || !fs.existsSync(path.join(reelDir(projectId), "media-analysis.json"))) {
      return NextResponse.json({ error: "No analysed reels project with that id." }, { status: 404 });
    }

    setStatus(projectId, "researching");
    await start(reelsWorkflow, [projectId, "replan"]);
    return NextResponse.json({ success: true, projectId });
  }

  let source: ReelSource;
  let name: string;

  if (body.album !== undefined) {
    if (!isPickedAlbum(body.album)) {
      return NextResponse.json({ error: "Invalid album." }, { status: 400 });
    }
    source = { kind: "photos", album: body.album.name, albumId: body.album.id, albumPath: body.album.path };
    name = body.album.name;
  } else {
    const raw = typeof body.source === "string" ? body.source.trim() : "";
    if (!raw) {
      return NextResponse.json({ error: "Choose an album, or enter a folder path." }, { status: 400 });
    }

    // An absolute path to an existing folder imports from disk; anything else is
    // taken as the name of a Photos album.
    const isFolder = path.isAbsolute(raw) && fs.existsSync(raw) && fs.statSync(raw).isDirectory();
    source = isFolder ? { kind: "folder", folder: raw } : { kind: "photos", album: raw };
    name = isFolder ? path.basename(raw) : raw;
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const projectId = `${slug || "album"}-${crypto.randomUUID()}`;

  fs.mkdirSync(reelDir(projectId), { recursive: true });
  const metadata: ReelProjectMetadata = { projectId, name, source, createdAt: new Date().toISOString() };
  fs.writeFileSync(path.join(reelDir(projectId), "metadata.json"), JSON.stringify(metadata, null, 2), "utf-8");
  setStatus(projectId, "importing");

  console.log("Starting reels workflow for:", name);

  await start(reelsWorkflow, [projectId, "create"]);

  return NextResponse.json({ success: true, projectId });
}
