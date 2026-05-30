import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

type Segment = { start: number; end: number };
type Short = { id: string; segments: Segment[] };
type Project = { name: string; shorts: Short[]; renderCount: number };

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3001",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const projectsDir = path.join(process.cwd(), "public", "projects");

  if (!fs.existsSync(projectsDir)) {
    return NextResponse.json([], { headers: corsHeaders });
  }

  const projects: Project[] = fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const projectName = entry.name;
      const instructionsPath = path.join(projectsDir, projectName, "instructions.json");

      if (!fs.existsSync(instructionsPath)) {
        return { name: projectName, shorts: [], renderCount: 0 };
      }

      const raw = fs.readFileSync(instructionsPath, "utf-8");
      const instructions = JSON.parse(raw) as { shorts?: Short[] };
      const shorts = instructions.shorts ?? [];

      return {
        name: projectName,
        shorts,
        renderCount: shorts.length,
      };
    });

  return NextResponse.json(projects, { headers: corsHeaders });
}