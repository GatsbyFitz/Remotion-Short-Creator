import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { InstructionsSchema } from "../shortsWorkflow/steps/instructionsShared";

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { projectId, shortId, title, description } = body as {
    projectId?: string;
    shortId?: string;
    title?: string;
    description?: string;
  };

  if (!projectId || typeof projectId !== "string" || !shortId || typeof shortId !== "string") {
    return NextResponse.json({ error: "projectId and shortId are required." }, { status: 400 });
  }

  const instructionsPath = path.join(process.cwd(), "public", "projects", projectId, "instructions.json");
  if (!fs.existsSync(instructionsPath)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const instructions = InstructionsSchema.parse(JSON.parse(fs.readFileSync(instructionsPath, "utf-8")));
  const shortIndex = instructions.shorts.findIndex((s) => s.id === shortId);
  if (shortIndex === -1) {
    return NextResponse.json({ error: "Short not found." }, { status: 404 });
  }

  const updated = InstructionsSchema.parse({
    shorts: instructions.shorts.map((s, i) =>
      i === shortIndex
        ? {
            ...s,
            ...(typeof title === "string" ? { title } : {}),
            ...(typeof description === "string" ? { description } : {}),
          }
        : s,
    ),
  });

  fs.writeFileSync(instructionsPath, JSON.stringify(updated, null, 2), "utf-8");

  return NextResponse.json({ success: true, short: updated.shorts[shortIndex] });
}
