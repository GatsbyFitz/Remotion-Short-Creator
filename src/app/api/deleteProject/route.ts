import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provisionId = searchParams.get("provisionId");

  if (!provisionId) {
    return NextResponse.json(
      { error: "Missing provisionId query parameter." },
      { status: 400 },
    );
  }

  const projectDir = path.join(process.cwd(), "public", "projects", provisionId);

  if (!fs.existsSync(projectDir)) {
    return NextResponse.json(
      { error: "Project not found." },
      { status: 404 },
    );
  }

  fs.rmSync(projectDir, { recursive: true, force: true });

  return NextResponse.json({ success: true, provisionId });
}