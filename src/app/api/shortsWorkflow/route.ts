import { NextRequest, NextResponse } from "next/server";
import { TranscribeRequest } from "../../../../types/schema";
import { start } from "workflow/api";
import { shortsWorkflow } from "./workflow";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { videoFilename } = TranscribeRequest.parse(body);
  console.log("Starting workflow for video:", videoFilename);

  await start(shortsWorkflow, [videoFilename]);

  return NextResponse.json({ success: true });
}


