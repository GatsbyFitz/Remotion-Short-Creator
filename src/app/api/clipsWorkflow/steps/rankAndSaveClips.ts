import fs from "fs";
import path from "node:path";
import {
  FrameItem,
  framesSpanningSegment,
  generateStructuredWithRepair,
} from "../../shortsWorkflow/steps/instructionsShared";
import {
  ClipCandidate,
  ClipReviewSchema,
  ClipScores,
  MAX_CLIPS,
  MIN_CLIPS,
  POST_WORTHY_SCORE,
  SocialClip,
  clipReviewPrompt,
  loadTranscript,
  scoreClip,
  spokenText,
} from "./clipsShared";

// Frames are extracted every 3s, so 5 covers a full 15s clip end-to-end.
const FRAMES_PER_CLIP = 5;

// How far an echoed start/end may drift from the real value before we treat the
// model's answer as misaligned with the candidate it claims to describe.
const ECHO_TOLERANCE_SECONDS = 0.05;

// The selection pass only ever saw a sampled visual timeline. This pass looks at
// frames across each candidate's actual duration alongside what's said in it,
// scores every candidate, keeps the best 5-8 and writes clips.json.
export async function rankAndSaveClips(project: string, candidates: ClipCandidate[], videoPayoff: string) {
  "use step";

  const framesPath = `public/projects/${project}/frames-manifest.json`;

  if (!fs.existsSync(framesPath)) {
    throw new Error(`Frames manifest file not found at path: ${framesPath}`);
  }

  if (candidates.length === 0) {
    throw new Error(`No clip candidates to review for "${project}".`);
  }

  const framesManifest = JSON.parse(fs.readFileSync(framesPath, "utf-8"));
  const frames: FrameItem[] = Array.isArray(framesManifest?.frames) ? framesManifest.frames : [];
  const { words } = loadTranscript(project);

  const grounded = candidates.map((clip, index) => ({
    index,
    clip,
    frames: framesSpanningSegment(frames, clip, FRAMES_PER_CLIP),
  }));

  // One call over every candidate, so the scores are relative to each other.
  // A failure here throws and the step retries: without the review the choice
  // of which clips to post would be a guess.
  const review = await generateStructuredWithRepair({
    model: "google/gemini-3.7-flash",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text" as const,
            text: clipReviewPrompt(
              grounded.map(({ index, clip }) => ({
                index,
                start: clip.start,
                end: clip.end,
                title: clip.title,
                kind: clip.kind,
                spoken: spokenText(words, clip),
              })),
              videoPayoff,
            ),
          },
          ...grounded.flatMap(({ index, clip, frames: clipFrames }) => [
            { type: "text" as const, text: `Candidate ${index}: ${clip.start}s - ${clip.end}s` },
            ...clipFrames.map((frame) => ({
              type: "image" as const,
              image: fs.readFileSync(path.join("public", frame.relativePath)),
              mediaType: "image/jpeg" as const,
            })),
          ]),
        ],
      },
    ],
    schema: ClipReviewSchema,
  });

  // Match on index, then use the echoed start/end only to confirm the model
  // lined its answer up with the candidate it claims to describe.
  const byIndex = new Map<number, { scores: ClipScores; note: string }>();

  for (const entry of review.reviews) {
    const candidate = candidates[entry.index];

    if (!candidate || byIndex.has(entry.index)) {
      continue;
    }

    if (
      Math.abs(entry.start - candidate.start) > ECHO_TOLERANCE_SECONDS ||
      Math.abs(entry.end - candidate.end) > ECHO_TOLERANCE_SECONDS
    ) {
      continue;
    }

    byIndex.set(entry.index, {
      scores: scoreClip({
        hook: entry.hook,
        spoken: entry.spoken,
        visual: entry.visual,
        curiosity: entry.curiosity,
        standalone: entry.standalone,
      }),
      note: entry.note,
    });
  }

  // Unreviewed candidates sort last, by the selection pass's own score, and
  // only get posted if they're needed to reach the minimum.
  const ranked = candidates
    .map((clip, index) => ({ clip, review: byIndex.get(index) }))
    .sort(
      (a, b) =>
        (b.review?.scores.total ?? -1) - (a.review?.scores.total ?? -1) || b.clip.score - a.clip.score,
    );

  const postWorthy = ranked.filter((r) => r.review && r.review.scores.total >= POST_WORTHY_SCORE).length;
  const chosen = ranked.slice(0, Math.min(MAX_CLIPS, Math.max(MIN_CLIPS, postWorthy)));

  const clips: SocialClip[] = chosen.map(({ clip, review: clipReview }) => ({
    id: clip.id,
    title: clip.title,
    start: clip.start,
    end: clip.end,
    kind: clip.kind,
    hook: clip.hook,
    curiosity: clip.curiosity,
    postCaption: clip.postCaption,
    scores: clipReview?.scores ?? null,
    ...(clipReview ? { reviewNote: clipReview.note } : {}),
  }));

  const clipsPath = `public/projects/${project}/clips.json`;
  fs.writeFileSync(clipsPath, JSON.stringify({ clips }, null, 2), "utf-8");

  console.log(
    `Clips: ${byIndex.size}/${candidates.length} candidates reviewed, ${postWorthy} scored ${POST_WORTHY_SCORE}+, ${clips.length} saved to ${clipsPath}.`,
  );

  return { clipCount: clips.length };
}
