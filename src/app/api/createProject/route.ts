import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!request.body) {
      return NextResponse.json(
        { error: "Missing request body." },
        { status: 400 },
      );
    }

    const projectId = crypto.randomUUID();
    const projectName = request.headers.get("x-project-name")?.trim() || projectId;
    const projectsDir = path.join(process.cwd(), "public", "projects");
    const projectDir = path.join(projectsDir, projectId);

    fs.mkdirSync(projectDir, { recursive: true });

    const videoPath = path.join(projectDir, "video.mp4");
    const out = fs.createWriteStream(videoPath);

    let bytesWritten = 0;
    const maxBytes = 20 * 1024 * 1024 * 1024; // example: 20 GB limit

    await new Promise<void>((resolve, reject) => {
      const reader = request.body?.getReader();

      if (!reader) {
        reject(new Error("Missing request body."));
        return;
      }

      const pump = async () => {
        const { done, value } = await reader.read();

        if (done) {
          out.end();
          return;
        }

        bytesWritten += value.byteLength;
        if (bytesWritten > maxBytes) {
          await reader.cancel();
          out.destroy(new Error("Upload exceeds max allowed size."));
          return;
        }

        if (!out.write(Buffer.from(value))) {
          out.once("drain", () => {
            void pump().catch(reject);
          });
          return;
        }

        void pump().catch(reject);
      };

      out.on("error", reject);
      out.on("finish", resolve);

      void pump().catch(reject);
    });

    fs.writeFileSync(
      path.join(projectDir, "metadata.json"),
      JSON.stringify(
        {
          projectId,
          projectName,
          createdAt: new Date().toISOString(),
          uploadedAt: new Date().toISOString(),
          fileSizeBytes: bytesWritten,
        },
        null,
        2,
      ),
      "utf-8",
    );

    return NextResponse.json({
      success: true,
      projectId,
      projectName,
      bytesWritten,
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