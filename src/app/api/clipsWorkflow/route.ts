import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { clipsWorkflow } from "./workflow";


export async function POST(request: NextRequest) {

  const body = await request.json();
  const { project } = body;

  if (!project || typeof project !== "string") {
    return NextResponse.json({ error: "project is required." }, { status: 400 });
  }

  console.log("Starting clips workflow for project:", project);

  await start(clipsWorkflow, [project]);

  return NextResponse.json({ success: true });
}
