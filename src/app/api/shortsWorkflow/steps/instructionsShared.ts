import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError, type ModelMessage } from "ai";

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

// Frames spread evenly across a segment's own duration, rather than clustered
// near its midpoint the way `framesForGap` is. For the framing QA pass the
// edges of a segment matter as much as its middle — a clipped watermark or
// caption is just as likely to appear at either end as in the centre.
export const framesSpanningSegment = (
  frames: FrameItem[],
  segment: { start: number; end: number },
  maxCount: number,
): FrameItem[] => {
  const inWindow = frames
    .filter(
      (f) => Number.isFinite(f.second) && f.second >= segment.start - 0.5 && f.second <= segment.end + 0.5,
    )
    .sort((a, b) => a.second - b.second);

  if (inWindow.length <= maxCount) return inWindow;

  const bucketSize = inWindow.length / maxCount;
  const picked: FrameItem[] = [];

  for (let i = 0; i < maxCount; i++) {
    const from = Math.floor(i * bucketSize);
    const bucket = inWindow.slice(from, Math.max(from + 1, Math.floor((i + 1) * bucketSize)));
    picked.push(bucket[Math.floor(bucket.length / 2)]);
  }

  return picked;
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
        youtubeVideoUrl: z.string().url().optional(),
        segments: z
          .array(
            z.object({
              start: z.number(),
              end: z.number(),
              transition: TransitionSchema,
              segment_purpose: z.string().optional(),
              focusX: z
                .number()
                .min(0)
                .max(1)
                .optional()
                .describe(
                  "Horizontal focal point of the crop, 0..1: 0 keeps the LEFT edge of the footage in view, 0.5 = centred (default), 1 keeps the RIGHT edge.",
                ),
              scale: z
                .number()
                .min(0)
                .max(1)
                .optional()
                .describe(
                  "1 (default when omitted) = full edge-to-edge crop, no letterboxing. 0 = full letterboxed contain, entire source frame visible. Only lower when content would otherwise be clipped at both edges or in a corner focusX alone can't fix.",
                ),
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
        arcId: z
          .string()
          .min(1)
          .describe("A short, unique, URL-safe slug for this narrative arc, e.g. 'overcoming-fear'.")
          .transform(toKebab),
        title: z.string().describe("A concise, social-media-friendly title for this narrative arc."),
        hook: z.string().describe("The opening moment or line that grabs attention in the first few seconds."),
        conflict: z.string().describe("The tension, problem, or stakes driving the middle of the story."),
        payoff: z.string().describe("The resolution, lesson, or emotional payoff at the end."),
        rationale: z.string().describe("One or two sentences on why this arc works well as a short-form video."),
      }),
    )
    .min(3)
    .max(7)
    .describe("Distinct, compelling narrative arc candidates extracted from the transcript."),
});

export type NarrativeCandidate = z.infer<typeof NarrativeCandidatesSchema>["candidates"][number];

export async function generateStructuredWithRepair<S extends z.ZodTypeAny>({
  model,
  messages,
  schema,
}: {
  model: string;
  messages: ModelMessage[];
  schema: S;
}): Promise<z.infer<S>> {
  try {
    const result = await generateText({ model, messages, output: Output.object({ schema }) });
    return result.output as z.infer<S>;
  } catch (err) {
    if (!NoObjectGeneratedError.isInstance(err) || !err.text) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`generateStructuredWithRepair: model "${model}" failed: ${message}`, { cause: err });
    }

    console.warn(
      `generateStructuredWithRepair: model "${model}" failed schema validation, attempting one repair pass:`,
      err.message,
    );

    try {
      const repair = await generateText({
        model,
        messages: [
          ...messages,
          { role: "assistant", content: err.text },
          {
            role: "user",
            content: `That response did not match the required JSON schema. Error: ${err.message}\n\nReturn ONLY corrected JSON matching the schema — no prose, no markdown fences.`,
          },
        ],
        output: Output.object({ schema }),
      });
      return repair.output as z.infer<S>;
    } catch (repairErr) {
      const repairMessage = repairErr instanceof Error ? repairErr.message : String(repairErr);
      throw new Error(
        `generateStructuredWithRepair: model "${model}" failed schema validation on both the initial attempt and the repair pass: ${repairMessage}`,
        { cause: repairErr },
      );
    }
  }
}

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
      gapIndex: z.number().int().min(0).describe("The 0-based index of the gap this candidate refers to."),
      description: z.string().describe("What's visually happening in this gap, in one or two sentences."),
      worth_including: z
        .boolean()
        .describe("Whether this visual moment is compelling enough to use as a standalone segment."),
      rationale: z.string().describe("One or two sentences on why this gap is (or isn't) worth including."),
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
- Propose between 3 and 7 distinct narrative candidates.
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

// Output of the framing QA pass. `index` is the match key back onto the short's
// own segments; `start`/`end` are echoed purely so the merge can sanity-check
// that the model lined its answers up with the right segments.
export const VisualFramingSchema = z.object({
  segments: z.array(
    z.object({
      index: z
        .number()
        .int()
        .min(0)
        .describe("The 0-based index of the segment this applies to, matching the order the segments were given."),
      start: z.number().describe("Echo this segment's exact start time back, unchanged, for validation only."),
      end: z.number().describe("Echo this segment's exact end time back, unchanged, for validation only."),
      focusX: z
        .number()
        .min(0)
        .max(1)
        .describe("Horizontal focal point 0..1: 0 keeps the LEFT edge in view, 1 the RIGHT edge, 0.5 centred."),
      scale: z
        .number()
        .min(0)
        .max(1)
        .describe("1 = full edge-to-edge crop (the default). Lower only when clipping forces it."),
    }),
  ),
});

export const visualFramingPrompt = (
  shortTitle: string,
  shortDescription: string,
  segments: Array<{ index: number; start: number; end: number; segment_purpose?: string }>,
) => `
You are doing a visual-framing quality pass on a finished vertical short. For each segment you are shown frames sampled across that segment's own full duration, not just its start or end.

Return only JSON matching the schema. Return exactly one entry per segment listed below, using its exact "index" — do not add, drop, reorder, or merge segments. Echo back each segment's exact "start" and "end" unchanged.

Render geometry (this is what focusX and scale actually control):
- The source footage is landscape, placed into a vertical band that is narrower than it is tall.
- At scale = 1 (the default) the footage is cropped edge-to-edge to fill that band. The full height is always visible — nothing is ever cropped at the top or bottom. Only the left and right edges are cropped, so you cannot see the full width of the frame at once.
- "focusX" (0..1) slides which part of that cropped width stays in view: 0 keeps the LEFT edge of the shot, 1 keeps the RIGHT edge, 0.5 is centred. It only chooses which side to sacrifice — it can never reveal both edges at once.
- Lowering "scale" below 1 reveals progressively more of the original width, at the cost of empty letterboxed space appearing above and below the footage. At scale = 0 the entire original frame is visible with maximum letterboxing.

How to choose:
- Default to scale = 1. Only lower it when BOTH are true: (a) important on-screen text, a graphic/watermark/readout, or the main subject is visibly cut off at an edge in the sampled frames, AND (b) no single focusX value avoids that clipping — e.g. the content spans both edges at once, or sits in a corner where fixing one side clips the other.
- Lower scale only as much as needed. A small reduction (0.7-0.85) is usually enough; only approach 0 if content genuinely spans edge to edge.
- Letterboxing is a visible downgrade from a full-bleed crop, so treat scale < 1 as a last resort, not a style choice.
- If the subject is centred or already looks fine at scale = 1, set scale = 1 and focusX = 0.5.

Short: "${shortTitle}" — ${shortDescription}

Segments (each segment's frames follow immediately after this listing, in the same index order):
${JSON.stringify(segments)}
`;
