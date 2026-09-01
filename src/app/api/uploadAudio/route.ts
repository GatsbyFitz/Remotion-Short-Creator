import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    // 1. Extract the form data from the client request
    const formData = await request.formData();
    
    const audioFile = formData.get("audio") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const audioSizeBytesStr = formData.get("audioSizeBytes") as string | null;

    // Validation checks
    if (!audioFile || !projectId) {
      return NextResponse.json(
        { error: "Missing audio file or projectId" },
        { status: 400 }
      );
    }

    // 2. Resolve the destination folder path (e.g., public/projects/[projectId])
    const targetDir = path.join(
      process.cwd(),
      "public",
      "projects",
      projectId
    );

    // Ensure the project folder exists
    await fs.mkdir(targetDir, { recursive: true });

    // 3. Convert the File object arrayBuffer into a Node.js Buffer
    const bytes = await audioFile.arrayBuffer();
    const buffer = new Uint8Array(bytes);

    // 4. Safe filepath using the explicit filename ('audio.mp4', 'audio.aac', etc.)
    const filePath = path.join(targetDir, audioFile.name);

    // 5. Write the audio binary to the project directory filesystem
    await fs.writeFile(filePath, buffer);

    // ==========================================
    // UPDATE METADATA.JSON WITH AUDIO DETAILS
    // ==========================================
    const metadataPath = path.join(targetDir, "metadata.json");

    // Read and parse the strictly expected metadata file
    const rawMetadata = await fs.readFile(metadataPath, "utf-8");
    const currentMetadata = JSON.parse(rawMetadata);

    // Calculate the size either from direct buffer bytes or form fallback fields
    const resolvedAudioSize = audioSizeBytesStr ? parseInt(audioSizeBytesStr, 10) : buffer.byteLength;

    // Merge new structural file size indicators into your existing metadata schema layout
    const updatedMetadata = {
      ...currentMetadata,
      audioFileSizeBytes: resolvedAudioSize,
      audioUploadedAt: new Date().toISOString(),
    };

    // Commit configuration parameters back out to local file space
    await fs.writeFile(
      metadataPath,
      JSON.stringify(updatedMetadata, null, 2),
      "utf-8"
    );
    // ==========================================

    return NextResponse.json({ 
      success: true, 
      message: `Successfully uploaded stripped audio track to ${audioFile.name} and appended audio metrics to metadata.` 
    });

  } catch (error) {
    console.error("Audio upload api error:", error);
    return NextResponse.json(
      { error: "Internal server error saving audio file" },
      { status: 500 }
    );
  }
}