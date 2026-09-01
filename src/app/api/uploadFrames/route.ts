import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises"; // or use native 'fs/promises'
import path from "path";

export async function POST(request: NextRequest) {
  try {
    // 1. Extract the form data from the client request
    const formData = await request.formData();
    
    const frameFile = formData.get("frame") as File | null;
    const projectId = formData.get("projectId") as string | null;

    // Validation checks
    if (!frameFile || !projectId) {
      return NextResponse.json(
        { error: "Missing frame file or projectId" },
        { status: 400 }
      );
    }

    // 2. Resolve the destination folder path (e.g., public/projects/[projectId]/frames)
    const targetDir = path.join(
      process.cwd(),
      "public",
      "projects",
      projectId,
      "frames"
    );

    // Ensure the folder path recursively exists
    await fs.mkdir(targetDir, { recursive: true });

    // 3. Convert the File object arrayBuffer into a Node.js Buffer
    const bytes = await frameFile.arrayBuffer();
    const buffer = new Uint8Array(bytes);

    // 4. Safe filepath using the filename passed by FormData ('frame_0.jpg')
    const filePath = path.join(targetDir, frameFile.name);

    // 5. Write the image binary to the project directory filesystem
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({ 
      success: true, 
      message: `Successfully uploaded ${frameFile.name}` 
    });

  } catch (error) {
    console.error("Frame upload api error:", error);
    return NextResponse.json(
      { error: "Internal server error saving frame file" },
      { status: 500 }
    );
  }
}