import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { InstructionsSchema } from "../shortsWorkflow/steps/instructionsShared";
import { cancelJob, enqueueRender, getJob, listJobs } from "./renderer";

export const runtime = "nodejs";
// Renders take minutes and stream progress via polling, so this route must
// never be prerendered or cached.
export const dynamic = "force-dynamic";

/**
 * Assets the composition hard-fails on if they are missing. Catching these up
 * front turns a cryptic "Error loading image" thrown minutes into a render into
 * an immediate, actionable message — which matters most on a fresh server,
 * where `public/miscellaneous/**` is gitignored and so arrives empty.
 */
const requiredAssets = (projectId: string) => [
  {
    path: path.join(process.cwd(), "public", "projects", projectId, "video.mp4"),
    hint: "the project's source video",
  },
  {
    path: path.join(process.cwd(), "public", "projects", projectId, "video-captions.json"),
    hint: "captions — run the workflow's transcribe step first",
  },
  {
    path: path.join(process.cwd(), "public", "miscellaneous", "profile.jpg"),
    hint: "the end-screen profile image, which is gitignored and must be copied to the server",
  },
];

const readInstructions = (projectId: string) => {
  const instructionsPath = path.join(
    process.cwd(),
    "public",
    "projects",
    projectId,
    "instructions.json",
  );
  if (!fs.existsSync(instructionsPath)) return null;
  return InstructionsSchema.parse(JSON.parse(fs.readFileSync(instructionsPath, "utf-8")));
};

/**
 * Starts a render. Returns immediately with the queued job(s) — poll GET for
 * progress. Omit `shortId` to queue every short in the project.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { projectId, shortId } = body as { projectId?: string; shortId?: string };

  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  let instructions;
  try {
    instructions = readInstructions(projectId);
  } catch (err) {
    return NextResponse.json(
      { error: `instructions.json is malformed: ${(err as Error).message}` },
      { status: 422 },
    );
  }

  if (!instructions) {
    return NextResponse.json(
      { error: "Project has no instructions.json yet. Run the workflow first." },
      { status: 404 },
    );
  }

  const missing = requiredAssets(projectId).filter((asset) => !fs.existsSync(asset.path));
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot render — missing ${missing.length === 1 ? "asset" : "assets"}: ${missing
          .map((m) => `${path.relative(process.cwd(), m.path)} (${m.hint})`)
          .join("; ")}`,
      },
      { status: 422 },
    );
  }

  // Index has to be the position within the full list so the output filename
  // matches the id the Studio would have used for the same short.
  const targets = instructions.shorts
    .map((short, index) => ({ short, index }))
    .filter(({ short }) => (shortId ? short.id === shortId : true));

  if (targets.length === 0) {
    return NextResponse.json({ error: "Short not found." }, { status: 404 });
  }

  const jobs = targets.map(({ short, index }) =>
    enqueueRender({
      projectId,
      shortId: short.id,
      shortTitle: short.title,
      shortIndex: index,
      segments: short.segments,
    }),
  );

  return NextResponse.json({ jobs });
}

/** `?jobId=` for one job, `?projectId=` for a project's jobs, else all. */
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  const projectId = request.nextUrl.searchParams.get("projectId");

  if (jobId) {
    const job = getJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    return NextResponse.json({ job });
  }

  return NextResponse.json({ jobs: listJobs(projectId ?? undefined) });
}

export async function DELETE(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required." }, { status: 400 });
  }

  if (!cancelJob(jobId)) {
    return NextResponse.json(
      { error: "Job not found, or already finished." },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
