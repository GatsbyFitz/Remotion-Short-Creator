import fs from "fs";
import { FrameItem } from "../../shortsWorkflow/steps/instructionsShared";
import { analyseVideoFrames } from "../../clipsWorkflow/steps/frameAnalysis";

// Model calls in flight at once. A 30 minute video is ~600 frames, or ~20 calls.
const INDEX_CONCURRENCY = 6;

// Adds every extracted frame of a video project to the analysis library, so
// its footage is searchable and later clip scans are served from the library.
// Frames already indexed are skipped, so it's safe to re-run.
export async function indexVideoFrames(project: string) {
  "use step";

  const framesPath = `public/projects/${project}/frames-manifest.json`;

  if (!fs.existsSync(framesPath)) {
    throw new Error(`Frames manifest file not found at path: ${framesPath}`);
  }

  const framesManifest = JSON.parse(fs.readFileSync(framesPath, "utf-8"));
  const frames: FrameItem[] = (Array.isArray(framesManifest?.frames) ? framesManifest.frames : [])
    .filter((f: FrameItem) => Number.isFinite(f.second) && f.second >= 0)
    .sort((a: FrameItem, b: FrameItem) => a.second - b.second);

  const result = await analyseVideoFrames(project, frames, INDEX_CONCURRENCY);

  console.log(
    `Footage index for "${project}": ${result.moments.length}/${frames.length} frames indexed (${result.cached} already, ${result.analysed} new, ${result.failedBatches}/${result.totalBatches} batches failed).`,
  );

  // Partial failures are kept; a re-run picks up only what's missing.
  if (result.failedBatches > 0) {
    throw new Error(`${result.failedBatches} of ${result.totalBatches} batches failed for "${project}".`);
  }

  return { indexed: result.moments.length, frames: frames.length };
}
