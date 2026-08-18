import fs from "fs";
import path from "node:path";
import {
  TranscriptSegment,
  TranscriptWord,
  FrameItem,
  VisualCandidate,
  NarrativeCandidate,
  computeVisualGaps,
  framesForGap,
  visualCandidatesPrompt,
  pass1Prompt,
  NarrativeCandidatesSchema,
  VisualCandidatesSchema,
  MAX_VISUAL_FRAMES,
  generateStructuredWithRepair,
} from "./instructionsShared";

export type NarrativeCandidatesResult = {
  cleansegments: TranscriptSegment[];
  words: TranscriptWord[];
  videoDuration: number | undefined;
  frames: FrameItem[];
  pass1Candidates: NarrativeCandidate[];
  visualCandidates: VisualCandidate[];
};

// Pass 1: propose narrative candidates from the transcript, in parallel with
// the visual pass that vets which silent gaps are worth using as standalone
// visual segments. Splitting this into its own step means a later pass
// failing doesn't force these (already-paid-for) LLM calls to rerun.
export async function generateNarrativeCandidates(project: string): Promise<NarrativeCandidatesResult> {
  "use step";

  const transcriptPath = `public/projects/${project}/transcript.json`;
  const framesPath = `public/projects/${project}/frames-manifest.json`;

  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`Transcript file not found at path: ${transcriptPath}`);
  }

  if (!fs.existsSync(framesPath)) {
    throw new Error(`Frames manifest file not found at path: ${framesPath}`);
  }

  const transcriptData = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));
  const transcriptSegments = Array.isArray(transcriptData?.segments)
    ? transcriptData.segments
    : [];

  const cleansegments: TranscriptSegment[] = transcriptSegments.map(
    (segment: { start: number; end: number; text: string }) => ({
      start: Math.round(segment.start * 1000) / 1000,
      end: Math.round(segment.end * 1000) / 1000,
      text: segment.text.replace(/\./g, "").replace(/\s+/g, " ").trim(),
    }),
  );

  const words: TranscriptWord[] = Array.isArray(transcriptData?.words)
    ? transcriptData.words
    : [];

  const videoDuration: number | undefined =
    typeof transcriptData?.duration === "number" ? transcriptData.duration : undefined;

  const framesManifest = JSON.parse(fs.readFileSync(framesPath, "utf-8"));
  const frames: FrameItem[] = Array.isArray(framesManifest?.frames)
    ? framesManifest.frames
    : [];

  const visualGaps = computeVisualGaps(cleansegments, videoDuration);

  // Keep total attached images bounded regardless of video length: try 2
  // frames/gap first, fall back to 1/gap, then fall back to the largest
  // gaps only if there are still too many.
  let gapFrameMap = visualGaps.map((gap) => ({ gap, frames: framesForGap(frames, gap, 2) }));
  let totalVisualFrames = gapFrameMap.reduce((sum, g) => sum + g.frames.length, 0);

  if (totalVisualFrames > MAX_VISUAL_FRAMES) {
    gapFrameMap = visualGaps.map((gap) => ({ gap, frames: framesForGap(frames, gap, 1) }));
    totalVisualFrames = gapFrameMap.reduce((sum, g) => sum + g.frames.length, 0);
  }

  if (totalVisualFrames > MAX_VISUAL_FRAMES) {
    gapFrameMap = [...gapFrameMap]
      .sort((a, b) => b.gap.end - b.gap.start - (a.gap.end - a.gap.start))
      .slice(0, MAX_VISUAL_FRAMES);
  }

  const visualPassPromise =
    gapFrameMap.length > 0
      ? generateStructuredWithRepair({
          model: "google/gemini-3.7-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: visualCandidatesPrompt(
                    gapFrameMap.map((g) => g.gap),
                    cleansegments,
                  ),
                },
                ...gapFrameMap.flatMap((g, i) => [
                  { type: "text" as const, text: `Gap ${i}: ${g.gap.start}s - ${g.gap.end}s` },
                  ...g.frames.map((frame) => ({
                    type: "image" as const,
                    image: fs.readFileSync(path.join("public", frame.relativePath)),
                    mediaType: "image/jpeg" as const,
                  })),
                ]),
              ],
            },
          ],
          schema: VisualCandidatesSchema,
        })
      : Promise.resolve(null);

  const [pass1, visualPass] = await Promise.all([
    generateStructuredWithRepair({
      model: "google/gemini-3.7-flash",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: pass1Prompt(cleansegments) }],
        },
      ],
      schema: NarrativeCandidatesSchema,
    }),
    visualPassPromise,
  ]);

  const visualCandidates: VisualCandidate[] = (visualPass?.candidates ?? [])
    .filter((c) => c.worth_including && gapFrameMap[c.gapIndex])
    .map((c) => ({
      start: gapFrameMap[c.gapIndex].gap.start,
      end: gapFrameMap[c.gapIndex].gap.end,
      description: c.description,
    }));

  console.log("Visual gaps found:", visualGaps.length);
  console.log("Visual candidates worth including:", visualCandidates.length);
  console.log("Pass 1 candidates:", pass1.candidates.length);

  return {
    cleansegments,
    words,
    videoDuration,
    frames,
    pass1Candidates: pass1.candidates,
    visualCandidates,
  };
}
