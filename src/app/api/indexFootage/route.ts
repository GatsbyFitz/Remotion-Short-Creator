import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { indexFootageWorkflow } from "./workflow";

export const runtime = "nodejs";

// Also guards against path traversal: project ids end up in file paths.
const PROJECT_ID_PATTERN = /^[a-z0-9-]+$/;

export async function POST(request: NextRequest) {
  const { project } = (await request.json()) as { project?: string };

  if (
    !project ||
    !PROJECT_ID_PATTERN.test(project) ||
    !fs.existsSync(path.join(process.cwd(), "public", "projects", project, "frames-manifest.json"))
  ) {
    return NextResponse.json({ error: "No video project with frames under that id." }, { status: 404 });
  }

  await start(indexFootageWorkflow, [project]);

  return NextResponse.json({ success: true });
}
