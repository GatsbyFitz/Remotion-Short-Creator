import { NextResponse } from "next/server";
import { PhotosAccessError, listPhotosAlbums } from "../reelsWorkflow/steps/photosAlbum";

export const runtime = "nodejs";

// Every album in the Mac's Photos library, with its folder path and item
// count, for the reels album picker. Asks macOS for permission to control
// Photos the first time.
export async function GET() {
  try {
    return NextResponse.json({ albums: await listPhotosAlbums() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't read the Photos library." },
      { status: err instanceof PhotosAccessError ? 403 : 502 },
    );
  }
}
