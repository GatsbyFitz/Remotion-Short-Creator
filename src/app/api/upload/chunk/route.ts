import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get("uploadId");
  const indexParam = searchParams.get("index");
  const index = indexParam ? Number.parseInt(indexParam, 10) : Number.NaN;

  if (!uploadId || Number.isNaN(index) || index < 0) {
    return NextResponse.json(
      { error: "Missing or invalid uploadId/index." },
      { status: 400 },
    );
  }

  if (!request.body) {
    return NextResponse.json({ error: "Missing request body." }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), ".uploads", uploadId);
  fs.mkdirSync(uploadsDir, { recursive: true });

  const chunkPath = path.join(uploadsDir, `${index}.part`);
  const nodeStream = Readable.fromWeb(request.body as unknown as NodeReadableStream);
  const out = fs.createWriteStream(chunkPath);

  await new Promise<void>((resolve, reject) => {
    nodeStream.on("error", reject);
    out.on("error", reject);
    out.on("finish", resolve);

    nodeStream.pipe(out);
  });

  return NextResponse.json({ success: true, index });
}
