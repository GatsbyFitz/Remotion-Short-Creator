import { NextRequest, NextResponse } from "next/server";
import { runpod } from "@runpod/ai-sdk-provider";
import { experimental_generateVideo as generateVideo } from "ai"

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.formData();

    const { video } = await generateVideo({
        model: runpod.video("alibaba/wan-2.6-t2v"),
        prompt: requestBody.get("prompt"),
        });


    return NextResponse.json({ success: true, video_url: video.url });
  } catch (error) {
    console.error("Error generating video:", error);
    return NextResponse.json(
      { error: "An error occurred while generating the video." },
      { status: 500 },
    );
  }
}