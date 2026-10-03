import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { indexedCounts, libraryStats, searchAssets } from "../../../lib/analysisDb";

export const runtime = "nodejs";

const PUBLIC_DIR = path.join(process.cwd(), "public");

const readJson = <T,>(file: string): T | null =>
  fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as T) : null;

// Names come from the projects' own metadata at request time, so renames show
// up without touching the library.
const projectNames = () => {
  const names = new Map<string, string>();
  for (const [type, dir, key] of [
    ["video", "projects", "projectName"],
    ["reels", "reels", "name"],
  ] as const) {
    const root = path.join(PUBLIC_DIR, dir);
    if (!fs.existsSync(root)) continue;
    for (const id of fs.readdirSync(root)) {
      const metadata = readJson<Record<string, string>>(path.join(root, id, "metadata.json"));
      if (metadata) names.set(`${type}:${id}`, metadata[key]?.trim() || id);
    }
  }
  return names;
};

// GET: library stats and each video project's indexing progress.
// GET ?q=...: also semantic search across every analysed photo, clip and frame.
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const names = projectNames();

  const indexed = indexedCounts("video");
  const videoProjects = [...names.entries()]
    .filter(([key]) => key.startsWith("video:"))
    .map(([key, name]) => {
      const id = key.slice("video:".length);
      const manifest = readJson<{ frameCount?: number }>(path.join(PUBLIC_DIR, "projects", id, "frames-manifest.json"));
      return { id, name, frameCount: manifest?.frameCount ?? 0, indexedFrames: indexed.get(id) ?? 0 };
    })
    .filter((project) => project.frameCount > 0);

  let results: Array<Record<string, unknown>> = [];
  if (query) {
    try {
      const matches = await searchAssets(query, 36);
      results = matches.flatMap((match) => {
        // Deleted projects leave locations behind; only show what still exists.
        const locations = match.locations
          .filter((l) => fs.existsSync(path.join(PUBLIC_DIR, l.image)))
          .map((l) => ({ ...l, projectName: names.get(`${l.projectType}:${l.projectId}`) ?? l.projectId }));
        return locations.length > 0 ? [{ ...match, locations }] : [];
      });
    } catch (err) {
      return NextResponse.json(
        { error: `Search failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ stats: libraryStats(), videoProjects, results });
}
