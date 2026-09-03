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
                .optional()
                .describe(
                  "Horizontal focal point of the crop, 0..1: 0 keeps the LEFT edge of the footage in view, 0.5 = centred (default), 1 keeps the RIGHT edge. The footage always fills the full width; only the horizontal crop window moves. Omit or use 0.5 to keep the shot centred.",
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

Horizontal framing (focusX):
- For each segment, look only at that segment's attached frames.
- The footage is landscape, cropped to a vertical 9:16 window that ALWAYS fills the full width of the short. Only the horizontal crop position can move; it never leaves a gap.
- Set "focusX" in [0,1] so the important subject/action stays in view: 0 keeps the left edge, 1 keeps the right edge, 0.5 is centred.
- Use 0.5 (or omit) when the subject is central, spans the frame, or you are unsure. Only move it when the subject is clearly toward one side.

Visual-only windows available (no speech present, pre-vetted as visually worthwhile):
${JSON.stringify(visualCandidates)}

Transcript:
${JSON.stringify(segments)}

Skeleton:
${JSON.stringify(skeleton)}

Selected Frames:
${JSON.stringify(selectedFrames)}
`;
