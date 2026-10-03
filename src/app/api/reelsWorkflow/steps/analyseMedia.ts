import fs from "fs";
import { generateStructuredWithRepair } from "../../shortsWorkflow/steps/instructionsShared";
import {
  StoredAnalysis,
  clearProjectLocations,
  contentKey,
  embedMissing,
  getAnalyses,
  mediaAssetId,
  saveAnalyses,
  saveLocations,
} from "../../../../lib/analysisDb";
import {
  AlbumSummarySchema,
  MediaAnalysis,
  MediaInsight,
  MediaInsightsSchema,
  MediaItem,
  MediaManifest,
  albumSummaryPrompt,
  mediaInsightsPrompt,
  readJson,
  reelPath,
  setStatus,
  writeJson,
} from "./reelsShared";

// Bump the version when the prompt or schema changes, so old answers stop
// being served from the library.
const MEDIA_ANALYZER = "album-media@1";
const MEDIA_MODEL = "google/gemini-3.7-flash";

// Media items per model call. Videos bring up to 3 frames each, so a batch is
// at most ~50 images. Batches run in parallel.
const ANALYSIS_BATCH_SIZE = 16;

type InsightData = Pick<MediaInsight, "shotType" | "focusX" | "bestStart">;

// Describes and scores every photo and clip, notes where each subject sits for
// cropping to vertical and where each video's best moment is, then sums up what
// the album is about so the trend research can search for the right niche.
//
// Goes through the analysis library: media seen before, in this album or any
// other, comes back from the database and only new media goes to the model.
// media-analysis.json is still written, as this project's own snapshot that
// the research and planning steps read.
export async function analyseMedia(project: string) {
  "use step";

  setStatus(project, "analysing");

  const manifest = readJson<MediaManifest>(reelPath(project, "media-manifest.json"));

  // Manifests from before the library have no content key; the converted
  // file stands in for them.
  const keyed = manifest.items.map((item) => ({
    item,
    assetId: mediaAssetId(item.contentKey ?? contentKey(reelPath(project, item.file))),
  }));

  const known = getAnalyses(MEDIA_ANALYZER, keyed.map((k) => k.assetId));
  const missing = keyed.filter((k) => !known.has(k.assetId));

  const batches: (typeof keyed)[] = [];
  for (let i = 0; i < missing.length; i += ANALYSIS_BATCH_SIZE) {
    batches.push(missing.slice(i, i + ANALYSIS_BATCH_SIZE));
  }

  const outcomes = await Promise.all(
    batches.map(async (batch, batchIndex) => {
      try {
        const result = await generateStructuredWithRepair({
          model: MEDIA_MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "text" as const, text: mediaInsightsPrompt(batch.length) },
                ...batch.flatMap(({ item }, index) => [
                  {
                    type: "text" as const,
                    text:
                      item.kind === "video"
                        ? `Media ${index} (video, ${item.duration?.toFixed(1)}s)`
                        : `Media ${index} (photo)`,
                  },
                  ...item.thumbs.flatMap((thumb) => [
                    ...(thumb.second !== undefined
                      ? [{ type: "text" as const, text: `frame at ${thumb.second}s` }]
                      : []),
                    {
                      type: "image" as const,
                      image: fs.readFileSync(reelPath(project, thumb.file)),
                      mediaType: "image/jpeg" as const,
                    },
                  ]),
                ]),
              ],
            },
          ],
          schema: MediaInsightsSchema,
        });

        const rows = result.items
          .filter((entry) => batch[entry.index])
          .map((entry): StoredAnalysis & { kind: MediaItem["kind"] } => {
            const { item, assetId } = batch[entry.index];
            const data: InsightData = {
              shotType: entry.shotType,
              focusX: Math.min(1, Math.max(0, entry.focusX)),
              bestStart:
                item.kind === "video" && entry.bestStart !== null
                  ? Math.min(Math.max(0, entry.bestStart), item.duration ?? 0)
                  : null,
            };
            return {
              assetId,
              kind: item.kind,
              analyzer: MEDIA_ANALYZER,
              model: MEDIA_MODEL,
              description: entry.description,
              score: Math.min(10, Math.max(0, entry.score)),
              data,
            };
          });

        saveAnalyses(rows);
        for (const row of rows) known.set(row.assetId, row);
        return true;
      } catch (err) {
        // A failed batch leaves those items unanalysed, and the plan won't use
        // them, rather than failing the whole album.
        console.warn(
          `Media analysis batch ${batchIndex + 1}/${batches.length} failed for "${project}":`,
          err instanceof Error ? err.message : err,
        );
        return false;
      }
    }),
  );

  if (batches.length > 0 && outcomes.every((ok) => !ok) && known.size === 0) {
    throw new Error(`Media analysis failed for every batch of "${project}".`);
  }

  const items = keyed.flatMap(({ item, assetId }): MediaInsight[] => {
    const analysis = known.get(assetId);
    if (!analysis) return [];
    const data = analysis.data as InsightData;
    return [
      {
        id: item.id,
        description: analysis.description,
        score: analysis.score,
        shotType: data.shotType,
        focusX: data.focusX,
        bestStart: data.bestStart,
      },
    ];
  });

  // Rewritten whole: a re-import gives media new ids.
  clearProjectLocations("reels", project);
  saveLocations(
    keyed.flatMap(({ item, assetId }) =>
      known.has(assetId) && item.thumbs[0]
        ? [
            {
              assetId,
              projectType: "reels" as const,
              projectId: project,
              mediaId: item.id,
              image: `reels/${project}/${item.thumbs[0].file}`,
            },
          ]
        : [],
    ),
  );

  try {
    await embedMissing();
  } catch (err) {
    // Search embeds anything missed before it runs, so this only delays searchability.
    console.warn("Couldn't embed new media analyses:", err instanceof Error ? err.message : err);
  }

  const album = await generateStructuredWithRepair({
    model: MEDIA_MODEL,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: albumSummaryPrompt(items.map((i) => i.description)) }],
      },
    ],
    schema: AlbumSummarySchema,
  });

  const analysis: MediaAnalysis = { ...album, items };
  writeJson(reelPath(project, "media-analysis.json"), analysis);

  console.log(
    `Media analysis: ${items.length}/${manifest.items.length} items (${keyed.length - missing.length} from the library). Album: ${album.niche}.`,
  );

  return { analysed: items.length };
}
