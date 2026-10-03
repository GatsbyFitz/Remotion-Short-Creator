import fs from "fs";
import { FrameItem, framesSpanningSegment } from "../../shortsWorkflow/steps/instructionsShared";
import { VisualMoment } from "./clipsShared";
import { analyseVideoFrames } from "./frameAnalysis";

// Caps the image cost regardless of video length. Frames are extracted every
// 3s, so this covers the first ~7.5 minutes frame-for-frame and samples evenly
// beyond that (every ~13s for a 30 minute video).
const MAX_SCAN_FRAMES = 150;

// Model calls in flight at once.
const SCAN_CONCURRENCY = 5;

// Builds a visual timeline of the whole video — a 0-10 interest score and a
// short description per sampled frame — so the selection pass can find clips
// that are engaging to look at, not only ones that are engaging to listen to.
// Frames already in the analysis library (from an earlier run, or from
// indexing the project's footage) aren't analysed again.
export async function scanVisualMoments(project: string): Promise<VisualMoment[]> {
  "use step";

  const framesPath = `public/projects/${project}/frames-manifest.json`;

  if (!fs.existsSync(framesPath)) {
    throw new Error(`Frames manifest file not found at path: ${framesPath}`);
  }

  const framesManifest = JSON.parse(fs.readFileSync(framesPath, "utf-8"));
  const frames: FrameItem[] = (Array.isArray(framesManifest?.frames) ? framesManifest.frames : [])
    .filter((f: FrameItem) => Number.isFinite(f.second) && f.second >= 0)
    .sort((a: FrameItem, b: FrameItem) => a.second - b.second);

  if (frames.length === 0) {
    console.warn(`Visual scan: no frames for "${project}", clips will be chosen from the transcript alone.`);
    return [];
  }

  const sampled = framesSpanningSegment(
    frames,
    { start: frames[0].second, end: frames[frames.length - 1].second },
    MAX_SCAN_FRAMES,
  );

  const result = await analyseVideoFrames(project, sampled, SCAN_CONCURRENCY);

  // With every batch gone and nothing cached, the clips would silently be
  // chosen on speech alone, so throw and let the step retry instead.
  if (result.moments.length === 0 && result.totalBatches > 0) {
    throw new Error(`Visual scan failed for every batch of "${project}".`);
  }

  const moments = [...result.moments].sort((a, b) => a.second - b.second);

  console.log(
    `Visual scan: ${moments.length}/${sampled.length} frames scored (${result.cached} from the library, ${result.analysed} new), ${moments.filter((m) => m.score >= 8).length} rated 8+.`,
  );

  return moments;
}
