import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const thumbnail = formData.get("thumbnail");
    const projectId = formData.get("projectId");

    if (!(thumbnail instanceof File) || typeof projectId !== "string" || !projectId.trim()) {
      return NextResponse.json(
        { error: "Missing thumbnail file or projectId" },
        { status: 400 },
      );
    }

    const rawExt = path.extname(thumbnail.name).toLowerCase();
    const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : "";

    if (!ext) {
      return NextResponse.json(
        { error: "Unsupported thumbnail format. Use JPG, PNG, or WEBP." },
        { status: 400 },
      );
    }

    const safeProjectId = projectId.trim();
    const projectDir = path.join(process.cwd(), "public", "projects", safeProjectId);

    if (!fs.existsSync(projectDir)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const fileName = `thumbnail${ext}`;
    const thumbnailPath = path.join(projectDir, fileName);
    const bytes = await thumbnail.arrayBuffer();
    fs.writeFileSync(thumbnailPath, Buffer.from(bytes));

    const relativePath = `/projects/${safeProjectId}/${fileName}`;

    return NextResponse.json({
      success: true,
      fileName,
      thumbnailPath: relativePath,
    });
  } catch (error) {
    console.error("Thumbnail upload api error:", error);
    return NextResponse.json(
      { error: "Internal server error saving thumbnail" },
      { status: 500 },
    );
  }
}
