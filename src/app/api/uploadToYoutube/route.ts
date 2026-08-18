import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { InstructionsSchema } from "../shortsWorkflow/steps/instructionsShared";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId, shortId } = body as { projectId?: string; shortId?: string };

  if (!projectId || typeof projectId !== "string" || !shortId || typeof shortId !== "string") {
    return NextResponse.json({ error: "projectId and shortId are required." }, { status: 400 });
  }

  const instructionsPath = path.join(process.cwd(), "public", "projects", projectId, "instructions.json");
  if (!fs.existsSync(instructionsPath)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const instructions = InstructionsSchema.parse(JSON.parse(fs.readFileSync(instructionsPath, "utf-8")));
  const short = instructions.shorts.find((s) => s.id === shortId);
  if (!short) {
    return NextResponse.json({ error: "Short not found." }, { status: 404 });
  }

  // Shorts are rendered manually via Remotion Studio/CLI today, landing in
  // out/ as `ShortCreator-<shortId>-<index>.mp4`. Match by prefix (not by
  // splitting the filename) since shortId itself can contain hyphens.
  const outDir = path.join(process.cwd(), "out");
  const prefix = `ShortCreator-${shortId}-`;
  const matches = fs.existsSync(outDir)
    ? fs
        .readdirSync(outDir)
        .filter((f) => f.startsWith(prefix))
        .map((f) => ({ f, mtime: fs.statSync(path.join(outDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
    : [];

  if (matches.length === 0) {
    return NextResponse.json(
      { error: `No rendered file found in out/ for "${shortId}". Render it via Remotion Studio first.` },
      { status: 404 },
    );
  }

  const videoPath = path.join(outDir, matches[0].f);

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "YouTube upload is not configured (missing OAuth env vars)." }, { status: 500 });
  }

  const { google } = await import("googleapis");
  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: YOUTUBE_REFRESH_TOKEN });
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  let data;
  try {
    ({ data } = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title: short.title, description: short.description },
        status: { privacyStatus: "public" },
      },
      media: { body: fs.createReadStream(videoPath) },
    }));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload to YouTube." },
      { status: 502 },
    );
  }

  const youtubeVideoUrl = data.id ? `https://www.youtube.com/watch?v=${data.id}` : undefined;
  if (youtubeVideoUrl) {
    const updated = InstructionsSchema.parse({
      shorts: instructions.shorts.map((s) => (s.id === shortId ? { ...s, youtubeVideoUrl } : s)),
    });
    fs.writeFileSync(instructionsPath, JSON.stringify(updated, null, 2), "utf-8");
  }

  return NextResponse.json({ success: true, youtubeVideoUrl });
}
