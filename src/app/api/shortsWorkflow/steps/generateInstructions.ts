import { generateText, Output } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "node:path";

type TranscriptSegment = { start: number; end: number; text: string };
type FrameItem = { second: number; relativePath: string; fileName?: string };

const toKebab = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const TransitionSchema = z
  .enum(["fade", "slide", "wipe", "flip", "iris", "clockWipe"])
  .optional();

const InstructionsSchema = z.object({
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

const NarrativeCandidatesSchema = z.object({
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

const SkeletonSchema = z.object({
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

const sampleFramesNearTimestamps = (
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

const pass1Prompt = (segments: TranscriptSegment[]) => `
You are analyzing one long transcript to find strong short-form stories.

Return only JSON matching the schema.

Task:
- Propose exactly 5 narrative candidates.
- Each candidate should be distinct and compelling.
- Focus on hook, conflict, payoff.
- Keep titles concise and social-friendly.

Transcript:
${JSON.stringify(segments)}
`;

const pass2Prompt = (
  segments: TranscriptSegment[],
  candidates: z.infer<typeof NarrativeCandidatesSchema>["candidates"],
) => `
You are selecting and structuring short-form narratives.

Return only JSON matching the schema.

Task:
- Select the best 3 to 6 narratives from candidates.
- Build 4 to 8 segments per short.
- Segment duration should generally be 6 to 10 seconds.
- Prefer non-sequential storytelling with temporal jumps.
- Segment times must be valid and non-overlapping within each short.
- Segments may come from transcript-backed or visual-only moments.
- Never cut in the middle of spoken words.
- Segment start/end must align to transcript boundaries whenever speech is present.
- Prefer starting and ending at natural pauses between words/phrases.

Candidates:
${JSON.stringify(candidates)}

Transcript:
${JSON.stringify(segments)}
`;

const pass3Prompt = (
  segments: TranscriptSegment[],
  skeleton: z.infer<typeof SkeletonSchema>,
  selectedFrames: Array<{ second: number; fileName?: string }>,
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
- You may include visual-only moments if they add narrative value.
- Prefer non-sequential storytelling with temporal jumps.
- Never cut in the middle of spoken words.
- Segment start/end must align to transcript boundaries whenever speech is present.
- Prefer starting and ending at natural pauses between words/phrases.

Narrative structure:
- Segment 1 is a strong hook.
- Middle segments escalate or deepen story.
- Final segment provides payoff, lesson, or CTA.

Transcript:
${JSON.stringify(segments)}

Skeleton:
${JSON.stringify(skeleton)}

Selected Frames:
${JSON.stringify(selectedFrames)}
`;

export async function generateRemotionInstructions(project: string) {
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

  const framesManifest = JSON.parse(fs.readFileSync(framesPath, "utf-8"));
  const frames: FrameItem[] = Array.isArray(framesManifest?.frames)
    ? framesManifest.frames
    : [];

  try {
    const pass1 = await generateText({
      model: "deepseek/deepseek-v4-pro",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: pass1Prompt(cleansegments) }],
        },
      ],
      output: Output.object({ schema: NarrativeCandidatesSchema }),
    });

    const pass2 = await generateText({
      model: "deepseek/deepseek-v4-pro",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: pass2Prompt(cleansegments, pass1._output.candidates),
            },
          ],
        },
      ],
      output: Output.object({ schema: SkeletonSchema }),
    });

    const targetSeconds = pass2._output.shorts.flatMap((short) =>
      short.segments.flatMap((segment) => [segment.start, segment.end]),
    );

    const selectedFrames = sampleFramesNearTimestamps(frames, targetSeconds, 2, 8);

    const frameParts = selectedFrames.map((frame) => ({
      type: "image" as const,
      image: fs.readFileSync(path.join("public", frame.relativePath)),
      mediaType: "image/jpeg",
    }));

    console.log("Pass 1 candidates:", pass1._output.candidates.length);
    console.log("Pass 2 shorts:", pass2._output.shorts.length);
    console.log("Selected frame count:", selectedFrames.length);

    const pass3 = await generateText({
      model: "deepseek/deepseek-v4-pro",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: pass3Prompt(
                cleansegments,
                pass2._output,
                selectedFrames.map((f) => ({
                  second: f.second,
                  fileName: f.fileName,
                })),
              ),
            },
            ...frameParts,
          ],
        },
      ],
      output: Output.object({ schema: InstructionsSchema }),
    });

    const RemotionInstructions = pass3._output;

    fs.writeFileSync(
      `public/projects/${project}/instructions.json`,
      JSON.stringify(RemotionInstructions, null, 2),
      "utf-8",
    );

    return { RemotionInstructions };
  } catch (err) {
    console.error("generateRemotionInstructions error:", err);
    throw err;
  }
}