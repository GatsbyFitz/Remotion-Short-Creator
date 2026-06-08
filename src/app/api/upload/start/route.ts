import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const uploadId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const uploadsDir = path.join(process.cwd(), ".uploads", uploadId);

  fs.mkdirSync(uploadsDir, { recursive: true });

  return NextResponse.json({ uploadId, projectId });
}
