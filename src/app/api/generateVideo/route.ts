import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runpod } from "@runpod/ai-sdk-provider";
import { experimental_generateVideo as generateVideo } from "ai";

export const runtime = "nodejs";

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.formData();
    const prompt = requestBody.get("prompt");

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
    }

    const { video } = await generateVideo({
      model: runpod.video("alibaba/wan-2.6-t2v"),
      prompt,
    });

    // The SDK hands back the bytes, not a hosted URL, so the result has to be
    // written somewhere the browser can fetch it from.
    const outputDir = path.join(process.cwd(), "public", "generated");
    await fs.mkdir(outputDir, { recursive: true });

    const extension = EXTENSION_BY_MEDIA_TYPE[video.mediaType] ?? "mp4";
    const filename = `${randomUUID()}.${extension}`;
    await fs.writeFile(path.join(outputDir, filename), video.uint8Array);

    return NextResponse.json({
      success: true,
      video_url: `/generated/${filename}`,
    });
  } catch (error) {
    console.error("Error generating video:", error);
    return NextResponse.json(
      { error: "An error occurred while generating the video." },
      { status: 500 },
    );
  }
}
