import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing MP4 file in form field `file`." },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Uploaded file is empty." },
        { status: 400 },
      );
    }

    const projectId = crypto.randomUUID();
    const projectsDir = path.join(process.cwd(), "public", "projects");
    const projectDir = path.join(projectsDir, projectId);

    fs.mkdirSync(projectDir, { recursive: true });

    const videoPath = path.join(projectDir, "video.mp4");
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(videoPath, buffer);

    return NextResponse.json({
      success: true,
      projectId,
      projectPath: `/projects/${projectId}`,
      videoPath: `/projects/${projectId}/video.mp4`,
    });
  } catch (error) {
    console.error("createProject error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create project",
      },
      { status: 500 },
    );
  }
}