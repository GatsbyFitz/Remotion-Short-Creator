import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const uploadId = crypto.randomUUID();
  const projectName = request.headers.get("x-project-name")?.trim() || "Untitled Project";

  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const projectId = `${slug}-${crypto.randomUUID()}`;
  const uploadsDir = path.join(process.cwd(), ".uploads", uploadId);

  fs.mkdirSync(uploadsDir, { recursive: true });

  return NextResponse.json({
    uploadId,
    projectId,
    projectName,
  });
}
