import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

type CompletePayload = {
  uploadId: string;
  projectId: string;
  totalChunks: number;
  projectName?: string;
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as Partial<CompletePayload>;
  const uploadId = payload.uploadId;
  const projectId = payload.projectId;
  const totalChunks = payload.totalChunks;
  const projectName = typeof payload.projectName === "string" ? payload.projectName.trim() : "";

  if (
    !uploadId ||
    !projectId ||
    typeof totalChunks !== "number" ||
    !Number.isInteger(totalChunks) ||
    totalChunks <= 0
  ) {
    return NextResponse.json(
      { error: "Missing or invalid uploadId/projectId/totalChunks." },
      { status: 400 },
    );
  }

  const safeTotalChunks = totalChunks;

  const uploadsDir = path.join(process.cwd(), ".uploads", uploadId);
  if (!fs.existsSync(uploadsDir)) {
    return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
  }

  const projectDir = path.join(process.cwd(), "public", "projects", projectId);
  fs.mkdirSync(projectDir, { recursive: true });

  const metadataPath = path.join(projectDir, "metadata.json");

  const videoPath = path.join(projectDir, "video.mp4");
  const out = fs.createWriteStream(videoPath);

  try {
    for (let i = 0; i < safeTotalChunks; i += 1) {
      const chunkPath = path.join(uploadsDir, `${i}.part`);
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`Missing chunk ${i}.`);
      }

      await new Promise<void>((resolve, reject) => {
        const input = fs.createReadStream(chunkPath);
        input.on("error", reject);
        input.on("end", resolve);
        input.pipe(out, { end: false });
      });
    }
  } catch (error) {
    out.destroy();
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to assemble upload." },
      { status: 500 },
    );
  }

  await new Promise<void>((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
    out.end();
  });

  const resolvedProjectName = projectName || projectId;
  fs.writeFileSync(
    metadataPath,
    JSON.stringify(
      {
        projectId,
        projectName: resolvedProjectName,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf-8",
  );

  fs.rmSync(uploadsDir, { recursive: true, force: true });

  return NextResponse.json({
    success: true,
    projectId,
    projectName: resolvedProjectName,
    projectPath: `/projects/${projectId}`,
    videoPath: `/projects/${projectId}/video.mp4`,
  });
}
