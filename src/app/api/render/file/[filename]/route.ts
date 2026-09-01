import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { OUT_DIR } from "../../renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toWebStream = (stream: Readable) =>
  Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;

/**
 * Serves rendered videos out of `out/`, which sits outside `public/` and so is
 * not covered by Next's static file handling. Supports Range requests so the
 * result is seekable in a browser rather than download-only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // Never let a crafted name escape out/ — basename strips any traversal, and
  // the resolve check catches anything basename would not.
  const safeName = path.basename(decodeURIComponent(filename));
  const filePath = path.join(OUT_DIR, safeName);

  if (path.dirname(path.resolve(filePath)) !== path.resolve(OUT_DIR)) {
    return NextResponse.json({ error: "Invalid filename." }, { status: 400 });
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return NextResponse.json({ error: "Rendered file not found." }, { status: 404 });
  }

  const size = fs.statSync(filePath).size;
  const range = request.headers.get("range");

  const baseHeaders = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Disposition": `inline; filename="${safeName}"`,
  };

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number.parseInt(match[1], 10) : 0;
      const end = match[2] ? Number.parseInt(match[2], 10) : size - 1;

      if (Number.isFinite(start) && start < size && end >= start) {
        const clampedEnd = Math.min(end, size - 1);
        return new NextResponse(
          toWebStream(fs.createReadStream(filePath, { start, end: clampedEnd })),
          {
            status: 206,
            headers: {
              ...baseHeaders,
              "Content-Range": `bytes ${start}-${clampedEnd}/${size}`,
              "Content-Length": String(clampedEnd - start + 1),
            },
          },
        );
      }

      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
  }

  return new NextResponse(toWebStream(fs.createReadStream(filePath)), {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}
