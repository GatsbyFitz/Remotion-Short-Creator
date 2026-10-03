import fs from "fs";
import { z } from "zod";
import {
  END_PAD_SECONDS,
  TranscriptSegment,
  TranscriptWord,
  snapToWordBoundary,
  toKebab,
} from "../../shortsWorkflow/steps/instructionsShared";

export const MIN_CLIP_SECONDS = 5;
export const MAX_CLIP_SECONDS = 15;
export const MIN_CLIPS = 5;
export const MAX_CLIPS = 8;

// The selection pass over-generates so the footage review has real options to
// drop. Fewer for short videos, where there isn't room for many distinct clips.
export const MAX_CANDIDATES = 14;

// How far a proposed clip's length may miss the 5-15s window and still pass
// schema validation. The deterministic fit below pulls it the rest of the way;
// anything further off is a misread of the brief and goes back for repair.
const DURATION_SLACK_SECONDS = 2;

// Snapping pads each edge a little, so two clips that share a boundary in the
// model's answer can end up overlapping by a fraction of a second. That's not
// duplicated content, so it doesn't count as an overlap.
const OVERLAP_TOLERANCE_SECONDS = 0.25;

// A reviewed clip scoring at least this (0-10) is worth posting; the final cut
// takes every one of those, clamped to MIN_CLIPS..MAX_CLIPS.
export const POST_WORTHY_SCORE = 6;

// Footage scored below this is unusable (black, lens cap, pocket, heavy blur),
// and a great line of dialogue doesn't rescue it.
const UNWATCHABLE_VISUAL_SCORE = 3;

export type VisualMoment = { second: number; score: number; description: string };

export type ClipKind = "spoken" | "visual" | "both";

export type ClipCandidate = {
  id: string;
  title: string;
  start: number;
  end: number;
  kind: ClipKind;
  hook: string;
  curiosity: string;
  postCaption: string;
  score: number;
};

export type ClipScores = {
  hook: number;
  spoken: number;
  visual: number;
  curiosity: number;
  standalone: number;
  total: number;
};

// What lands in clips.json, one entry per clip, best first.
export type SocialClip = Omit<ClipCandidate, "score"> & {
  scores: ClipScores | null;
  reviewNote?: string;
};

const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export type LoadedTranscript = {
  segments: TranscriptSegment[];
  words: TranscriptWord[];
  duration: number | undefined;
};

// Unlike the shorts passes, punctuation is kept: sentence ends are exactly where
// a clip should start and stop, and the model can only see them if they survive.
export const loadTranscript = (project: string): LoadedTranscript => {
  const transcriptPath = `public/projects/${project}/transcript.json`;

  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`Transcript file not found at path: ${transcriptPath}`);
  }

  const transcriptData = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));

  const segments: TranscriptSegment[] = (
    Array.isArray(transcriptData?.segments) ? transcriptData.segments : []
  )
    .map((segment: { start: number; end: number; text: string }) => ({
      start: round(segment.start, 2),
      end: round(segment.end, 2),
      text: segment.text.replace(/\s+/g, " ").trim(),
    }))
    .filter((segment: TranscriptSegment) => segment.text !== "");

  const words: TranscriptWord[] = Array.isArray(transcriptData?.words) ? transcriptData.words : [];

  const duration: number | undefined =
    typeof transcriptData?.duration === "number" ? transcriptData.duration : undefined;

  return { segments, words, duration };
};

export const spokenText = (words: TranscriptWord[], clip: { start: number; end: number }) =>
  words
    .filter((w) => w.start >= clip.start && w.end <= clip.end)
    .map((w) => w.word.trim())
    .join(" ");

// Snap a proposed clip to word boundaries, then force it into the 5-15s window
// without cutting a word in half.
export const fitClipTiming = (
  proposed: { start: number; end: number },
  words: TranscriptWord[],
  videoDuration: number | undefined,
): { start: number; end: number } => {
  const lastSecond = videoDuration ?? Number.POSITIVE_INFINITY;

  let start = snapToWordBoundary(clamp(proposed.start, 0, lastSecond), words, "start");
  let end = snapToWordBoundary(clamp(proposed.end, 0, lastSecond), words, "end");

  if (end - start > MAX_CLIP_SECONDS) {
    // Too long: end on the last word that finishes inside the limit, so the trim
    // lands between words.
    const limit = start + MAX_CLIP_SECONDS - END_PAD_SECONDS;
    const lastWord = [...words].reverse().find((w) => w.end <= limit && w.start >= start);

    if (lastWord && lastWord.end - start >= MIN_CLIP_SECONDS) {
      end = snapToWordBoundary(lastWord.end, words, "end");
    } else {
      // No word ends in range because a single "word" spans the limit — Whisper
      // stretches words across music and long pauses. Cut just before it.
      const spanning = words.find(
        (w) => w.start < start + MAX_CLIP_SECONDS && w.end > start + MAX_CLIP_SECONDS,
      );
      end =
        spanning && spanning.start - start >= MIN_CLIP_SECONDS ? spanning.start : start + MAX_CLIP_SECONDS;
    }
  }

  if (end - start < MIN_CLIP_SECONDS) {
    // Too short: run on to the end of whichever word is being spoken at the
    // minimum length, or straight to the minimum if that falls in a pause.
    const target = start + MIN_CLIP_SECONDS;
    const spanning = words.find((w) => w.start < target && w.end > target);
    end =
      spanning && spanning.end + END_PAD_SECONDS - start <= MAX_CLIP_SECONDS
        ? snapToWordBoundary(spanning.end, words, "end")
        : target;
  }

  // Near the end of the video the minimum can run past the last frame. Slide
  // the clip back rather than shortening it.
  if (end > lastSecond) {
    const length = end - start;
    end = lastSecond;
    start = snapToWordBoundary(Math.max(0, end - length), words, "start");

    if (end - start > MAX_CLIP_SECONDS) {
      // Snapping back to the start of a word overshot the limit, so start on the
      // first word inside it instead.
      const firstWord = words.find((w) => w.start >= end - MAX_CLIP_SECONDS);
      const wordStart =
        firstWord && end - firstWord.start >= MIN_CLIP_SECONDS
          ? snapToWordBoundary(firstWord.start, words, "start")
          : end - MAX_CLIP_SECONDS;
      start = Math.max(end - MAX_CLIP_SECONDS, wordStart);
    }
  }

  // Floored at the end of the video so rounding can never ask for a frame past it.
  return {
    start: round(start, 3),
    end: Math.min(round(end, 3), Math.floor(lastSecond * 1000) / 1000),
  };
};

// Greedy by the selection pass's own score: keep the strongest clip of any
// overlapping group, so no two posted clips repeat the same footage.
export const dropOverlaps = <T extends { start: number; end: number; score: number }>(clips: T[]): T[] => {
  const kept: T[] = [];

  for (const clip of [...clips].sort((a, b) => b.score - a.score)) {
    const overlaps = kept.some(
      (k) => Math.min(clip.end, k.end) - Math.max(clip.start, k.start) > OVERLAP_TOLERANCE_SECONDS,
    );
    if (!overlaps) {
      kept.push(clip);
    }
  }

  return kept.sort((a, b) => a.start - b.start);
};

// Clip ids become Remotion composition ids, so they must be non-empty and
// unique within the project.
export const uniqueIds = <T extends { id: string }>(clips: T[]): T[] => {
  const seen = new Map<string, number>();

  return clips.map((clip, index) => {
    const base = clip.id || `clip-${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { ...clip, id: count === 1 ? base : `${base}-${count}` };
  });
};

// What's said and what's seen are alternatives, not both requirements: a clip
// is engaging if either is strong, so the better of the two counts.
export const scoreClip = (review: Omit<ClipScores, "total">): ClipScores => {
  const content = Math.max(review.spoken, review.visual);
  let total = (review.hook + content + review.curiosity + review.standalone) / 4;

  if (review.visual < UNWATCHABLE_VISUAL_SCORE) {
    total *= 0.5;
  }

  return { ...review, total: round(total, 1) };
};

const formatSeconds = (value: number) => `${round(value, 2)}s`;

export const VisualScanSchema = z.object({
  frames: z.array(
    z.object({
      index: z.number().int().min(0).describe("The 0-based index of the frame, as labelled in the message."),
      score: z
        .number()
        .min(0)
        .max(10)
        .describe("Visual interest as the opening shot of a social media clip, 0-10."),
      description: z.string().describe("What's in shot, in under 15 words."),
    }),
  ),
});

export const visualScanPrompt = (frameCount: number) => `
You are scanning frames sampled from a long video to find the visually engaging moments, for cutting short social media teaser clips.

Return only JSON matching the schema — exactly one entry per frame (${frameCount} frames), using the index each frame is labelled with.

Score each frame's visual interest 0-10, judged as the opening shot of a clip that has to stop someone scrolling:
- 8-10: striking. Dramatic scenery or light, action or motion, an intense or emotional face, something unusual or surprising, a strong sense of scale or place, crowd or race atmosphere.
- 4-7: decent but ordinary. A pleasant view, a person talking to camera in a good setting.
- 0-3: dull or unusable. Black or very dark, blurry, only ground or sky, an obstructed lens, screens or menus, transition frames.

Describe what's in shot in under 15 words.
`;

export const ClipCandidatesSchema = z.object({
  videoPayoff: z
    .string()
    .describe(
      "One sentence: how the full video ends, or its final reveal or payoff. Used to keep clips from spoiling it.",
    ),
  clips: z
    .array(
      z
        .object({
          id: z
            .string()
            .min(1)
            .describe("A short, unique, URL-safe slug for this clip, e.g. 'storm-on-the-ridge'.")
            .transform(toKebab),
          title: z.string().describe("A short, punchy title for this clip — a few words."),
          start: z.number().describe("Clip start in seconds, taken from the transcript or visual timeline."),
          end: z
            .number()
            .describe(`Clip end in seconds. end - start must be between ${MIN_CLIP_SECONDS} and ${MAX_CLIP_SECONDS}.`),
          kind: z
            .enum(["spoken", "visual", "both"])
            .describe("Whether the clip works because of what's said, what's seen, or both."),
          hook: z.string().describe("What grabs a scrolling viewer in the first 1-2 seconds."),
          curiosity: z
            .string()
            .describe("The question or tension this clip leaves open, which the full video answers."),
          postCaption: z
            .string()
            .describe(
              "Text to post with the clip: one or two sentences that tease the full video, optionally ending with up to 3 relevant hashtags.",
            ),
          score: z.number().min(0).max(10).describe("How strong this clip is overall, 0-10."),
        })
        .refine(
          (clip) =>
            clip.end - clip.start >= MIN_CLIP_SECONDS - DURATION_SLACK_SECONDS &&
            clip.end - clip.start <= MAX_CLIP_SECONDS + DURATION_SLACK_SECONDS,
          { message: `Each clip's end - start must be between ${MIN_CLIP_SECONDS} and ${MAX_CLIP_SECONDS} seconds.` },
        ),
    )
    .min(MIN_CLIPS)
    .max(MAX_CANDIDATES + 2),
});

export const clipCandidatesPrompt = (
  segments: TranscriptSegment[],
  visualMoments: VisualMoment[],
  videoDuration: number,
  candidateCount: { min: number; max: number },
) => `
You are a social media video editor cutting short teaser clips from one long video. Each clip is posted on its own (Instagram, TikTok, X, YouTube) to make viewers curious enough to go and watch the full video.

Return only JSON matching the schema.

Task:
- Propose between ${candidateCount.min} and ${candidateCount.max} candidate clips. A later pass reviews the actual footage and keeps only the best ${MIN_CLIPS} to ${MAX_CLIPS}, so give it real options: vary the kind of moment and where in the video it comes from.
- Each clip is ONE continuous stretch of the video, between ${MIN_CLIP_SECONDS} and ${MAX_CLIP_SECONDS} seconds long (end - start). Aim for 7-12 seconds; only go longer when the moment needs it.
- Clips must not overlap each other.
- Spread clips across the whole video — beginning, middle and end — rather than clustering them.

What makes a good clip:
- It grabs attention in the first 1-2 seconds: a surprising or bold line, strong emotion, a question, high stakes, a striking view, or action. No slow build-ups, greetings, or filler like "so, um".
- It is engaging for what is SAID, what is SEEN, or both:
  - Spoken: a punchy line, a confession, a strong opinion, a funny moment, tension or doubt, a surprising fact or number.
  - Visual: use the visual timeline below. High-scoring moments (dramatic scenery, action, weather, crowds, emotion on faces) can carry a clip with little or no speech.
- It makes sense on its own to someone who hasn't seen the video: no dangling "he", "that" or "like I said" that needs earlier context.
- It opens a loop rather than closing it. Tease the stakes, the struggle or the question, but do NOT give away how the video ends or its final payoff. The viewer should need the full video to find out what happens.

Timing rules:
- Use times from the transcript and visual timeline below.
- Where there is speech, start at the beginning of a sentence or phrase and end at the end of one — never mid-word or mid-sentence. Prefer ending on a strong beat: a punchline, an open question, a reveal of the stakes.
- For visual clips, build around the high-scoring frames in the visual timeline and include the seconds around them. The timeline is sampled, so the footage between two strong neighbouring frames is likely strong too.
- Transcript lines of only "♪" are music, not speech. If the transcript is empty or mostly music, lean on visual clips.

Video duration: ${formatSeconds(videoDuration)}

Visual timeline (one line per sampled frame: time, visual interest 0-10, what's in shot):
${visualMoments.length > 0 ? visualMoments.map((m) => `[${formatSeconds(m.second)}] ${m.score}/10 — ${m.description}`).join("\n") : "(no frames available — choose from the transcript alone)"}

Transcript (one line per segment: [start-end] text):
${segments.length > 0 ? segments.map((s) => `[${s.start}-${s.end}] ${s.text}`).join("\n") : "(no speech)"}
`;

export const ClipReviewSchema = z.object({
  reviews: z.array(
    z.object({
      index: z
        .number()
        .int()
        .min(0)
        .describe("The 0-based index of the candidate this applies to, matching the order they were given."),
      start: z.number().describe("Echo this candidate's exact start time back, unchanged, for validation only."),
      end: z.number().describe("Echo this candidate's exact end time back, unchanged, for validation only."),
      hook: z.number().min(0).max(10).describe("How strongly the first 1-2 seconds grab a scrolling viewer."),
      spoken: z.number().min(0).max(10).describe("How engaging what's said is. 0 if nothing meaningful is said."),
      visual: z.number().min(0).max(10).describe("How engaging and watchable the footage is across the whole clip."),
      curiosity: z
        .number()
        .min(0)
        .max(10)
        .describe("How much it makes someone want to watch the full video, without giving away the ending."),
      standalone: z
        .number()
        .min(0)
        .max(10)
        .describe("Whether it makes sense on its own and starts and ends cleanly."),
      note: z.string().describe("One sentence on the clip's main strength or its main problem."),
    }),
  ),
});

export const clipReviewPrompt = (
  candidates: Array<{ index: number; start: number; end: number; title: string; kind: ClipKind; spoken: string }>,
  videoPayoff: string,
) => `
You are the final reviewer deciding which teaser clips from a long video get posted to social media. The goal of every posted clip is to make viewers want to watch the full video.

Return only JSON matching the schema. Return exactly one entry per candidate listed below, using its exact "index" — do not add, drop, reorder or merge candidates. Echo back each candidate's exact "start" and "end" unchanged.

Each candidate's frames follow this listing in index order. They are sampled across the clip's full duration, so the first frame is roughly what a viewer sees first. "spoken" is everything said during the clip.

Score each candidate 0-10 on:
- hook: how strongly the first 1-2 seconds stop someone scrolling — the opening line, the opening shot, or both.
- spoken: how engaging what's said is — punchy, emotional, funny, surprising, tense. 0 if there's no meaningful speech.
- visual: how engaging the footage is. Reserve 0-2 for footage that's unusable in any clip: black, lens cap, pocket, extreme blur. Plain but watchable footage of someone talking is 4-5.
- curiosity: how much it makes someone want to watch the full video. Score LOW if the clip gives away the ending below.
- standalone: whether it makes sense to someone who hasn't seen the video, and starts and ends cleanly rather than mid-sentence or mid-thought.

Be discerning and use the full range: only about ${MIN_CLIPS} to ${MAX_CLIPS} of these will be posted, and your scores decide which.

How the full video ends (clips should tease this, not reveal it): ${videoPayoff}

Candidates:
${JSON.stringify(candidates)}
`;
