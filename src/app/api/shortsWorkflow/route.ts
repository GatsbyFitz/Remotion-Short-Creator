import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { shortsWorkflow } from "./workflow";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { project } = body;
  console.log("Starting workflow for project:", project);

  await start(shortsWorkflow, [project]);

  return NextResponse.json({ success: true });
}


