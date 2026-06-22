import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

type Segment = { start: number; end: number };
type Short = { id: string; segments: Segment[] };
type Project = {
  id: string;
  name: string;
  shorts: Short[];
  renderCount: number;
  uploadedAt: string | null;
  fileSizeBytes: number | null;
};

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
      const projectId = entry.name;
      const projectDir = path.join(projectsDir, projectId);
      const instructionsPath = path.join(projectDir, "instructions.json");
      const metadataPath = path.join(projectDir, "metadata.json");
      const metadata = fs.existsSync(metadataPath)
        ? JSON.parse(fs.readFileSync(metadataPath, "utf-8")) as {
          projectName?: string;
          uploadedAt?: string;
          fileSizeBytes?: number;
        }
        : null;
      const projectName = metadata?.projectName?.trim() || projectId;
      const uploadedAt = typeof metadata?.uploadedAt === "string" ? metadata.uploadedAt : null;
      const fileSizeBytes = typeof metadata?.fileSizeBytes === "number" ? metadata.fileSizeBytes : null;

      if (!fs.existsSync(instructionsPath)) {
        return {
          id: projectId,
          name: projectName,
          shorts: [],
          renderCount: 0,
          uploadedAt,
          fileSizeBytes,
        };
      }

      const raw = fs.readFileSync(instructionsPath, "utf-8");
      const instructions = JSON.parse(raw) as { shorts?: Short[] };
      const shorts = instructions.shorts ?? [];

      return {
        id: projectId,
        name: projectName,
        shorts,
        renderCount: shorts.length,
        uploadedAt,
        fileSizeBytes,
      };
    });

  return NextResponse.json(projects, { headers: corsHeaders });
}