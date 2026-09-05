import { generateText, Output } from "ai";
import fs from "fs";
import path from "node:path";
import {
  TranscriptSegment,
  TranscriptWord,
  FrameItem,
  VisualCandidate,
  Skeleton,
  sampleFramesNearTimestamps,
  snapToWordBoundary,
  pass3Prompt,
  InstructionsSchema,
} from "./instructionsShared";

// Pass 3: ground the skeleton in actual frames near each segment's
// timestamps, finalize transitions, then clamp/snap segment boundaries to
// word timing and persist instructions.json.
export async function finalizeRemotionInstructions(
  project: string,
  cleansegments: TranscriptSegment[],
  words: TranscriptWord[],
  videoDuration: number | undefined,
  frames: FrameItem[],
  skeleton: Skeleton,
  visualCandidates: VisualCandidate[],
) {
  "use step";

  const targetSeconds = skeleton.shorts.flatMap((short) =>
    short.segments.flatMap((segment) => [segment.start, segment.end]),
  );

  const selectedFrames = sampleFramesNearTimestamps(frames, targetSeconds, 2, 8);

  const frameParts = selectedFrames.map((frame) => ({
    type: "image" as const,
    image: fs.readFileSync(path.join("public", frame.relativePath)),
    mediaType: "image/jpeg",
  }));

  console.log("Selected frame count:", selectedFrames.length);

  const pass3 = await generateText({
    model: "google/gemini-3.7-flash",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: pass3Prompt(
              cleansegments,
              skeleton,
              selectedFrames.map((f) => ({
                second: f.second,
                fileName: f.fileName,
              })),
              visualCandidates,
            ),
          },
          ...frameParts,
        ],
      },
    ],
    output: Output.object({ schema: InstructionsSchema }),
  });

  const clampToDuration = (time: number) =>
    videoDuration === undefined ? time : Math.min(Math.max(time, 0), videoDuration);

  const RemotionInstructions = {
    shorts: pass3._output.shorts.map((short) => ({
      ...short,
      segments: short.segments.map((segment) => {
        const clampedStart = clampToDuration(segment.start);
        const clampedEnd = clampToDuration(segment.end);
        // Framing is decided by the visual-framing QA pass that runs after this
        // step, against the final snapped segments. This pass shares
        // InstructionsSchema, so the model can still emit focusX/scale from the
        // schema shape alone even though nothing here asks for it — drop them so
        // the QA pass is the single source of truth.
        const rest = { ...segment };
        delete rest.focusX;
        delete rest.scale;
        return {
          ...rest,
          start: snapToWordBoundary(clampedStart, words, "start"),
          end: snapToWordBoundary(clampedEnd, words, "end"),
        };
      }),
    })),
  };

  fs.writeFileSync(
    `public/projects/${project}/instructions.json`,
    JSON.stringify(RemotionInstructions, null, 2),
    "utf-8",
  );

  return { RemotionInstructions };
}
