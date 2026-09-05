import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// Renames a project's video title (`metadata.json`'s `projectName`) — the
// title shown on the projects list and burned into every short generated
// from this project (see `videoTitle` in shortCreator/Main.tsx).
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { projectId, name } = body as { projectId?: string; name?: string };

  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!trimmedName) {
    return NextResponse.json({ error: "Video title can't be empty." }, { status: 400 });
  }

  const metadataPath = path.join(process.cwd(), "public", "projects", projectId, "metadata.json");
  if (!fs.existsSync(metadataPath)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
  const updated = { ...metadata, projectName: trimmedName };
  fs.writeFileSync(metadataPath, JSON.stringify(updated, null, 2), "utf-8");

  return NextResponse.json({ success: true, projectName: trimmedName });
}
