import fs from "fs";
import path from "node:path";
import { FrameItem, generateStructuredWithRepair } from "../../shortsWorkflow/steps/instructionsShared";
import {
  StoredAnalysis,
  contentKey,
  embedMissing,
  frameAssetId,
  getAnalyses,
  saveAnalyses,
  saveLocations,
} from "../../../../lib/analysisDb";
import { mapWithConcurrency } from "../../../../lib/mapWithConcurrency";
import { VisualMoment, VisualScanSchema, visualScanPrompt } from "./clipsShared";

// Bump the version when the prompt or schema changes, so old answers stop
// being served from the library.
export const FRAME_ANALYZER = "frame-scan@1";
const FRAME_MODEL = "google/gemini-3.7-flash";

// Frames per model call.
const BATCH_SIZE = 30;

export type FrameAnalysisResult = {
  moments: VisualMoment[];
  cached: number;
  analysed: number;
  failedBatches: number;
  totalBatches: number;
};

// Scores and describes video frames for visual interest, via the analysis
// library: frames it has seen before (same source video, same timestamp) come
// back from the database, and only the rest go to the model. Shared by the
// clips workflow's sampled scan and by full-footage indexing.
export const analyseVideoFrames = async (
  project: string,
  frames: FrameItem[],
  concurrency: number,
): Promise<FrameAnalysisResult> => {
  const videoPath = `public/projects/${project}/video.mp4`;
  // Keyed by the source video when it's there, so a re-upload reuses the old
  // analysis; otherwise by the frame image itself.
  const videoKey = fs.existsSync(videoPath) ? contentKey(videoPath) : null;

  const keyed = frames.map((frame) => ({
    frame,
    assetId: videoKey
      ? frameAssetId(videoKey, frame.second)
      : `frame:${contentKey(path.join("public", frame.relativePath))}`,
  }));

  const known = getAnalyses(FRAME_ANALYZER, keyed.map((k) => k.assetId));
  const locate = (items: typeof keyed) =>
    saveLocations(
      items.map((k) => ({
        assetId: k.assetId,
        projectType: "video" as const,
        projectId: project,
        second: k.frame.second,
        image: k.frame.relativePath.replace(/^\//, ""),
      })),
    );

  locate(keyed.filter((k) => known.has(k.assetId)));

  const missing = keyed.filter((k) => !known.has(k.assetId));
  const batches: (typeof keyed)[] = [];
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    batches.push(missing.slice(i, i + BATCH_SIZE));
  }

  const outcomes = await mapWithConcurrency(batches, concurrency, async (batch, batchIndex) => {
    try {
      const result = await generateStructuredWithRepair({
        model: FRAME_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text" as const, text: visualScanPrompt(batch.length) },
              ...batch.flatMap(({ frame }, index) => [
                { type: "text" as const, text: `Frame ${index} at ${frame.second}s` },
                {
                  type: "image" as const,
                  image: fs.readFileSync(path.join("public", frame.relativePath)),
                  mediaType: "image/jpeg" as const,
                },
              ]),
            ],
          },
        ],
        schema: VisualScanSchema,
      });

      const rows = result.frames
        .filter((entry) => batch[entry.index])
        .map((entry): StoredAnalysis & { kind: "frame" } => ({
          assetId: batch[entry.index].assetId,
          kind: "frame",
          analyzer: FRAME_ANALYZER,
          model: FRAME_MODEL,
          description: entry.description,
          score: Math.min(10, Math.max(0, entry.score)),
          data: {},
        }));

      // Saved per batch, so a long indexing run shows progress and a failure
      // part-way keeps everything finished before it.
      saveAnalyses(rows);
      for (const row of rows) known.set(row.assetId, row);
      locate(batch.filter((k) => known.has(k.assetId)));
      return true;
    } catch (err) {
      console.warn(
        `Frame analysis batch ${batchIndex + 1}/${batches.length} failed for "${project}":`,
        err instanceof Error ? err.message : err,
      );
      return false;
    }
  });

  try {
    await embedMissing();
  } catch (err) {
    // Search embeds anything missed before it runs, so this only delays searchability.
    console.warn("Couldn't embed new frame analyses:", err instanceof Error ? err.message : err);
  }

  const moments = keyed.flatMap(({ frame, assetId }) => {
    const analysis = known.get(assetId);
    return analysis ? [{ second: frame.second, score: analysis.score, description: analysis.description }] : [];
  });

  return {
    moments,
    cached: keyed.length - missing.length,
    analysed: missing.filter((k) => known.has(k.assetId)).length,
    failedBatches: outcomes.filter((ok) => !ok).length,
    totalBatches: batches.length,
  };
};
