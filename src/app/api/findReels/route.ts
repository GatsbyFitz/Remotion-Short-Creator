import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import type {
  MediaAnalysis,
  MediaManifest,
  Reel,
  ReelProjectMetadata,
  ReelStatus,
  TrendResearch,
} from "../reelsWorkflow/steps/reelsShared";

// Same reasoning as findProjects: Remotion renders load the bundle from an
// ephemeral localhost port, and Root.tsx registers the Reel compositions from
// this endpoint.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const readIfExists = <T,>(file: string): T | null =>
  fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as T) : null;

export async function GET() {
  const reelsDir = path.join(process.cwd(), "public", "reels");

  if (!fs.existsSync(reelsDir)) {
    return NextResponse.json([], { headers: corsHeaders });
  }

  const projects = fs
    .readdirSync(reelsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const dir = path.join(reelsDir, entry.name);
      const metadata = readIfExists<ReelProjectMetadata>(path.join(dir, "metadata.json"));
      if (!metadata) return [];

      const status = readIfExists<{ status: ReelStatus; detail?: string; updatedAt: string }>(
        path.join(dir, "status.json"),
      );
      const manifest = readIfExists<MediaManifest>(path.join(dir, "media-manifest.json"));
      const analysis = readIfExists<MediaAnalysis>(path.join(dir, "media-analysis.json"));
      const trends = readIfExists<TrendResearch>(path.join(dir, "trends.json"));
      const plan = readIfExists<{ generatedAt: string; trendsOrigin: "web" | "evergreen"; reels: Reel[] }>(
        path.join(dir, "reels.json"),
      );

      return [
        {
          id: entry.name,
          name: metadata.name,
          source: metadata.source,
          createdAt: metadata.createdAt,
          status: status?.status ?? null,
          statusDetail: status?.detail ?? null,
          photoCount: manifest?.items.filter((i) => i.kind === "photo").length ?? 0,
          videoCount: manifest?.items.filter((i) => i.kind === "video").length ?? 0,
          skippedCount: manifest?.skipped.length ?? 0,
          summary: analysis?.summary ?? null,
          trends: trends?.trends ?? [],
          trendsOrigin: plan?.trendsOrigin ?? trends?.origin ?? null,
          generatedAt: plan?.generatedAt ?? null,
          reels: plan?.reels ?? [],
        },
      ];
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json(projects, { headers: corsHeaders });
}
