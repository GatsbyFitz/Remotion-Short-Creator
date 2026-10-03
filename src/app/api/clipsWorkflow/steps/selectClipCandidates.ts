import { generateStructuredWithRepair } from "../../shortsWorkflow/steps/instructionsShared";
import {
  ClipCandidate,
  ClipCandidatesSchema,
  MAX_CANDIDATES,
  MAX_CLIP_SECONDS,
  MIN_CLIPS,
  MIN_CLIP_SECONDS,
  VisualMoment,
  clipCandidatesPrompt,
  dropOverlaps,
  fitClipTiming,
  loadTranscript,
  uniqueIds,
} from "./clipsShared";

export type ClipCandidatesResult = {
  videoPayoff: string;
  candidates: ClipCandidate[];
};

// Proposes more clips than will be posted, from the full transcript plus the
// visual timeline, then fits each to word boundaries and the 5-15s window and
// drops overlaps. Kept as its own step so a failure in the footage review
// doesn't force this (already-paid-for) call to rerun.
export async function selectClipCandidates(
  project: string,
  visualMoments: VisualMoment[],
): Promise<ClipCandidatesResult> {
  "use step";

  const { segments, words, duration } = loadTranscript(project);

  const videoDuration =
    duration ??
    Math.max(
      segments[segments.length - 1]?.end ?? 0,
      visualMoments[visualMoments.length - 1]?.second ?? 0,
    );

  // Roughly one candidate per 12s of video, so a short video isn't asked for
  // more distinct clips than it can hold.
  const maxCandidates = Math.min(MAX_CANDIDATES, Math.max(MIN_CLIPS, Math.floor(videoDuration / 12)));
  const minCandidates = Math.min(maxCandidates, MIN_CLIPS + 3);

  const result = await generateStructuredWithRepair({
    model: "google/gemini-3.7-flash",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: clipCandidatesPrompt(segments, visualMoments, videoDuration, {
              min: minCandidates,
              max: maxCandidates,
            }),
          },
        ],
      },
    ],
    schema: ClipCandidatesSchema,
  });

  const fitted = result.clips
    .map((clip) => ({ ...clip, ...fitClipTiming(clip, words, duration) }))
    .filter((clip) => {
      const length = clip.end - clip.start;
      return length >= MIN_CLIP_SECONDS - 0.01 && length <= MAX_CLIP_SECONDS + 0.01;
    });

  const candidates = uniqueIds(dropOverlaps(fitted));

  console.log(
    `Clip candidates: ${result.clips.length} proposed, ${fitted.length} fit ${MIN_CLIP_SECONDS}-${MAX_CLIP_SECONDS}s, ${candidates.length} after removing overlaps.`,
  );

  if (candidates.length < MIN_CLIPS) {
    console.warn(
      `Only ${candidates.length} distinct clip candidates for "${project}" — fewer than the ${MIN_CLIPS} minimum.`,
    );
  }

  return { videoPayoff: result.videoPayoff, candidates };
}
