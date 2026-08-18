import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

type Segment = { start: number; end: number; transition?: string; segment_purpose?: string };
type Short = { id: string; title: string; description: string; youtubeVideoUrl?: string; segments: Segment[] };
type Project = {
  id: string;
  name: string;
  shorts: Short[];
  renderCount: number;
  uploadedAt: string | null;
  fileSizeBytes: number | null;
  audioFileSizeBytes: number | null; // Added to structural type definition
  frameCount: number | null; // Added to structural type definition
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
          audioFileSizeBytes?: number; // Read target from json schema map
          frameCount?: number; // Read target from json schema map
        }
        : null;
        
      const projectName = metadata?.projectName?.trim() || projectId;
      const uploadedAt = typeof metadata?.uploadedAt === "string" ? metadata.uploadedAt : null;
      const fileSizeBytes = typeof metadata?.fileSizeBytes === "number" ? metadata.fileSizeBytes : null;
      
      // Handle missing audio sizes gracefully for legacy projects
      const audioFileSizeBytes = typeof metadata?.audioFileSizeBytes === "number" 
        ? metadata.audioFileSizeBytes 
        : null;

      if (!fs.existsSync(instructionsPath)) {
        return {
          id: projectId,
          name: projectName,
          shorts: [],
          renderCount: 0,
          uploadedAt,
          fileSizeBytes,
          audioFileSizeBytes,
          frameCount: metadata?.frameCount ?? null,
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
        audioFileSizeBytes,
        frameCount: metadata?.frameCount ?? null,
      };
    });

  return NextResponse.json(projects, { headers: corsHeaders });
}