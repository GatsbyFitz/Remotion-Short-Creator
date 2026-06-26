import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project } = body;

    if (!project || typeof project !== "string") {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const projectDir = path.join(process.cwd(), "public", "projects", project);
    const framesDir = path.join(projectDir, "frames");
    const manifestPath = path.join(projectDir, "frames-manifest.json");

    if (!fs.existsSync(framesDir)) {
      return NextResponse.json(
        { error: `Frames directory not found for project: ${project}` },
        { status: 404 },
      );
    }

    const frameFiles = fs
      .readdirSync(framesDir)
      .filter((f) => f.toLowerCase().endsWith(".jpg"));

    const frames = frameFiles.map((fileName) => {
  // Extract just the digits and decimal point between 'frame_' and 's.jpg'
        const secondMatch = fileName.match(/frame_([\d.]+)(?:s)?\.jpg/);
        
        // Use parseFloat, but fallback to -1 if the match completely fails
        const second = secondMatch ? parseFloat(secondMatch[1]) : -1;

        return {
            fileName,
            absolutePath: path.join(framesDir, fileName),
            relativePath: `/projects/${project}/frames/${fileName}`,
            second,
        };
        });

    // Sort frames chronologically so the manifest reads sequentially
    frames.sort((a, b) => a.second - b.second);

    const manifest = {
      project,
      frameCount: frames.length,
      framesDir,
      manifestPath,
      frames,
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    const metadataPath = path.join(projectDir, "metadata.json");
    const existingMetadata = fs.existsSync(metadataPath)
      ? JSON.parse(fs.readFileSync(metadataPath, "utf-8"))
      : {};

    fs.writeFileSync(
      metadataPath,
      JSON.stringify(
        {
          ...existingMetadata,
          frameCount: frames.length,
        },
        null,
        2,
      ),
      "utf-8",
    );

    return NextResponse.json(manifest, { status: 200 });
  } catch (err) {
    console.error("Failed to create frames manifest:", err);
    const errorMessage =
      err instanceof Error ? err.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}