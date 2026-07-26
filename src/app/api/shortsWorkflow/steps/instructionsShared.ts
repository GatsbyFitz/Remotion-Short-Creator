import { z } from "zod";

export type TranscriptSegment = { start: number; end: number; text: string };
export type TranscriptWord = { word: string; start: number; end: number };
export type FrameItem = { second: number; relativePath: string; fileName?: string };
export type VisualGap = { start: number; end: number };
export type VisualCandidate = { start: number; end: number; description: string };

export const START_PAD_SECONDS = 0.08;
export const END_PAD_SECONDS = 0.18;

// A "visual-only moment" is only legitimate if it sits inside a real pause in
// the transcript. Gaps shorter than this aren't worth building a segment
// around (the 6-10s segment-duration requirement wouldn't fit anyway).
export const MIN_VISUAL_GAP_SECONDS = 1.5;

// Keep total attached images bounded regardless of video length.
export const MAX_VISUAL_FRAMES = 40;

export const snapToWordBoundary = (
  time: number,
  words: TranscriptWord[],
  direction: "start" | "end",
): number => {
  if (words.length === 0) return time;

  // If `time` lands inside a word, that word's edge is the real boundary to pad from.
  const inside = words.find((w) => time > w.start && time < w.end);
  const boundary = inside ? (direction === "start" ? inside.start : inside.end) : time;

  // Never let padding eat into a neighbouring word's audio.
  const before = [...words].reverse().find((w) => w.end <= boundary);
  const after = words.find((w) => w.start >= boundary);

  if (direction === "start") {
    const floor = before ? before.end : 0;
    return Math.max(boundary - START_PAD_SECONDS, floor);
  }

  const ceiling = after ? after.start : boundary + END_PAD_SECONDS;
  return Math.min(boundary + END_PAD_SECONDS, ceiling);
};

export const computeVisualGaps = (
  segments: TranscriptSegment[],
  videoDuration: number | undefined,
): VisualGap[] => {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const gaps: VisualGap[] = [];

  if (sorted.length === 0) {
    if (videoDuration !== undefined) gaps.push({ start: 0, end: videoDuration });
    return gaps;
  }

  if (sorted[0].start >= MIN_VISUAL_GAP_SECONDS) {
    gaps.push({ start: 0, end: sorted[0].start });
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = sorted[i].end;
    const gapEnd = sorted[i + 1].start;
    if (gapEnd - gapStart >= MIN_VISUAL_GAP_SECONDS) {
      gaps.push({ start: gapStart, end: gapEnd });
    }
  }

  const last = sorted[sorted.length - 1];
  if (videoDuration !== undefined && videoDuration - last.end >= MIN_VISUAL_GAP_SECONDS) {
    gaps.push({ start: last.end, end: videoDuration });
  }

  return gaps;
};

// Frames strictly within a gap's own window, nearest to its midpoint first.
export const framesForGap = (frames: FrameItem[], gap: VisualGap, maxCount: number): FrameItem[] => {
  const mid = (gap.start + gap.end) / 2;
  return frames
    .filter((f) => Number.isFinite(f.second) && f.second >= gap.start - 0.5 && f.second <= gap.end + 0.5)
    .sort((a, b) => Math.abs(a.second - mid) - Math.abs(b.second - mid))
    .slice(0, maxCount);
};

export const toKebab = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const sampleFramesNearTimestamps = (
  frames: FrameItem[],
  targetSeconds: number[],
  perTarget = 2,
  windowSec = 8,
): FrameItem[] => {
  const out: FrameItem[] = [];
  const seen = new Set<string>();

  for (const t of targetSeconds) {
    const nearby = frames
      .filter((f) => Number.isFinite(f.second) && Math.abs(f.second - t) <= windowSec)
      .sort((a, b) => Math.abs(a.second - t) - Math.abs(b.second - t))
      .slice(0, perTarget);

    for (const frame of nearby) {
      const key = frame.relativePath;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(frame);
      }
    }
  }

  if (out.length === 0) {
    return frames;
  }

  return out;
};

const TransitionSchema = z
  .enum(["fade", "slide", "wipe", "flip", "iris", "clockWipe"])
  .optional();

export const InstructionsSchema = z.object({
  shorts: z
    .array(
      z.object({
        id: z.string().min(1).transform(toKebab),
        title: z.string(),
        description: z.string(),
        segments: z
          .array(
            z.object({
              start: z.number(),
              end: z.number(),
              transition: TransitionSchema,
              segment_purpose: z.string().optional(),
            }),
          )
          .min(4)
          .max(10),
      }),
    )
    .min(3)
    .max(6),
});

export const NarrativeCandidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        arcId: z.string().min(1).transform(toKebab),
        title: z.string(),
        hook: z.string(),
        conflict: z.string(),
        payoff: z.string(),
        rationale: z.string(),
      }),
    )
    .min(5)
    .max(5),
});

export type NarrativeCandidate = z.infer<typeof NarrativeCandidatesSchema>["candidates"][number];

export const SkeletonSchema = z.object({
  shorts: z
    .array(
      z.object({
        id: z.string().min(1).transform(toKebab),
        title: z.string(),
        description: z.string(),
        segments: z
          .array(
            z.object({
              start: z.number(),
              end: z.number(),
              segment_purpose: z.string().optional(),
            }),
          )
          .min(4)
          .max(8),
      }),
    )
    .min(3)
    .max(6),
});

export type Skeleton = z.infer<typeof SkeletonSchema>;

export const VisualCandidatesSchema = z.object({
  candidates: z.array(
    z.object({
      gapIndex: z.number().int().min(0),
      description: z.string(),
      worth_including: z.boolean(),
      rationale: z.string(),
    }),
  ),
});

export const visualCandidatesPrompt = (gaps: VisualGap[], segments: TranscriptSegment[]) => `
You are reviewing silent, non-speech windows in a video to judge which ones are visually compelling enough to use as standalone "visual-only" segments in a short-form edit (no dialogue, pure visual beat).

Return only JSON matching the schema.

Task:
- Each window below is numbered by gapIndex and followed by its frame(s) later in this message.
- For each window, judge from its attached frame(s) whether the visual content is interesting/compelling enough to stand alone as a segment.
- Briefly describe what is visually happening.
- Reference windows only by gapIndex — do not invent new windows or change the given start/end times.

Windows:
${JSON.stringify(gaps.map((g, i) => ({ gapIndex: i, start: g.start, end: g.end })))}

Surrounding transcript for context:
${JSON.stringify(segments)}
`;

export const pass1Prompt = (segments: TranscriptSegment[]) => `
You are analyzing one long transcript to find strong short-form stories.

Return only JSON matching the schema.

Task:
- Propose exactly 5 narrative candidates.
- Each candidate should be distinct and compelling.
- Focus on hook, conflict, payoff.
- The narrative should be clear and engaging, suitable for short-form video.
- Keep titles concise and social-friendly.

Transcript:
${JSON.stringify(segments)}
`;

export const pass2Prompt = (
  segments: TranscriptSegment[],
  candidates: NarrativeCandidate[],
  visualCandidates: VisualCandidate[],
) => `
You are selecting and structuring short-form narratives.

Return only JSON matching the schema.

Task:
- Select the best 3 to 6 narratives from candidates.
- Build 4 to 8 segments per short.
- Segment duration should generally be 6 to 10 seconds.
- Prefer non-sequential storytelling with temporal jumps.
- Segment times must be valid and non-overlapping within each short.
- Segments may come from transcript-backed moments, or from the visual-only windows listed below.
- Visual-only segments MUST use one of the exact windows listed below — do not invent new visual-only start/end times. If no visual-only windows are listed, only use transcript-backed segments.
- Never cut in the middle of spoken words.
- Segment start/end must align to transcript boundaries whenever speech is present.
- Prefer starting and ending at natural pauses between words/phrases.

Visual-only windows available (no speech present, pre-vetted as visually worthwhile):
${JSON.stringify(visualCandidates)}

Candidates:
${JSON.stringify(candidates)}

Transcript:
${JSON.stringify(segments)}
`;

export const pass3Prompt = (
  segments: TranscriptSegment[],
  skeleton: Skeleton,
  selectedFrames: Array<{ second: number; fileName?: string }>,
  visualCandidates: VisualCandidate[],
) => `
You are finalizing short instructions with visual grounding.

Return only JSON matching the schema.

Hard constraints:
- Create between 3 and 6 shorts.
- Each short should be 30-45 seconds (max 55).
- Each short should contain 4-10 segments.
- Segment end must be greater than segment start.
- Segments inside a short must not overlap.
- Use transition, default fade unless another transition is clearly better.
- Visual-only segments MUST use one of the exact windows listed in "Visual-only windows" below — never invent new ones.
- Prefer non-sequential storytelling with temporal jumps.
- Never cut in the middle of spoken words.
- Segment start/end must align to transcript boundaries whenever speech is present.
- Prefer starting and ending at natural pauses between words/phrases.

Narrative structure:
- Segment 1 is a strong hook.
- Middle segments escalate or deepen story.
- Final segment provides payoff, lesson, or CTA.

Visual-only windows available (no speech present, pre-vetted as visually worthwhile):
${JSON.stringify(visualCandidates)}

Transcript:
${JSON.stringify(segments)}

Skeleton:
${JSON.stringify(skeleton)}

Selected Frames:
${JSON.stringify(selectedFrames)}
`;
