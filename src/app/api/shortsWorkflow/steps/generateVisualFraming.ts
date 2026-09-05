import fs from "fs";
import path from "node:path";
import {
  FrameItem,
  InstructionsSchema,
  VisualFramingSchema,
  framesSpanningSegment,
  generateStructuredWithRepair,
  visualFramingPrompt,
} from "./instructionsShared";

// Frames sampled per segment. Frames are extracted every 3s and segments are
// typically 6-10s, so 4 covers a normal segment end-to-end without inflating
// the image-token cost of each call.
const FRAMES_PER_SEGMENT = 4;

// How far an echoed start/end may drift from the real value before we treat the
// model's answer as misaligned with the segment it claims to describe.
const ECHO_TOLERANCE_SECONDS = 0.05;

// Visual-framing QA: the last pass, run against the FINAL word-snapped segments
// rather than the skeleton's approximate ones. For each segment it looks at
// frames spanning that segment's own duration and decides how the footage
// should be framed inside the vertical band — focusX (which part of the
// cropped width stays in view) and scale (how much of the original width to
// reveal, at the cost of letterboxing).
//
// Standalone by design, like generateYoutubeChapters: it takes only the project
// and re-reads instructions.json/frames-manifest.json from disk, so it can be
// re-run on its own without regenerating a short's timing or narrative.
export async function generateVisualFraming(project: string) {
  "use step";

  const instructionsPath = `public/projects/${project}/instructions.json`;
  const framesPath = `public/projects/${project}/frames-manifest.json`;

  if (!fs.existsSync(instructionsPath)) {
    throw new Error(`Instructions file not found at path: ${instructionsPath}`);
  }

  if (!fs.existsSync(framesPath)) {
    throw new Error(`Frames manifest file not found at path: ${framesPath}`);
  }

  const instructions = InstructionsSchema.parse(
    JSON.parse(fs.readFileSync(instructionsPath, "utf-8")),
  );

  const framesManifest = JSON.parse(fs.readFileSync(framesPath, "utf-8"));
  const frames: FrameItem[] = Array.isArray(framesManifest?.frames) ? framesManifest.frames : [];

  // One call per short, all shorts in parallel. Each call sees only its own
  // short's segments, so the model has less to track than a whole-project call.
  const framingPerShort = await Promise.all(
    instructions.shorts.map(async (short) => {
      const sampled = short.segments.map((segment, index) => ({
        index,
        segment,
        frames: framesSpanningSegment(frames, segment, FRAMES_PER_SEGMENT),
      }));

      // A segment with no frames at all (very short, landing between two 3s
      // samples) gets no framing decision and falls back to the default.
      const grounded = sampled.filter((s) => s.frames.length > 0);

      if (grounded.length === 0) {
        console.warn(`Visual framing: no frames for any segment of "${short.id}", skipping.`);
        return null;
      }

      try {
        return await generateStructuredWithRepair({
          model: "google/gemini-3.7-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text" as const,
                  text: visualFramingPrompt(
                    short.title,
                    short.description,
                    grounded.map((s) => ({
                      index: s.index,
                      start: s.segment.start,
                      end: s.segment.end,
                      segment_purpose: s.segment.segment_purpose,
                    })),
                  ),
                },
                ...grounded.flatMap((s) => [
                  {
                    type: "text" as const,
                    text: `Segment ${s.index}: ${s.segment.start}s - ${s.segment.end}s`,
                  },
                  ...s.frames.map((frame) => ({
                    type: "image" as const,
                    image: fs.readFileSync(path.join("public", frame.relativePath)),
                    mediaType: "image/jpeg" as const,
                  })),
                ]),
              ],
            },
          ],
          schema: VisualFramingSchema,
        });
      } catch (err) {
        // One short failing shouldn't cost the whole pass — those segments just
        // keep the default framing.
        console.warn(
          `Visual framing failed for "${short.id}", leaving its segments at the default framing:`,
          err instanceof Error ? err.message : err,
        );
        return null;
      }
    }),
  );

  let segmentsUpdated = 0;
  let segmentsSkipped = 0;

  const updated = InstructionsSchema.parse({
    shorts: instructions.shorts.map((short, shortIndex) => {
      const framing = framingPerShort[shortIndex];

      // Match on index, then use the echoed start/end only to confirm the model
      // lined its answer up with the segment it claims to describe.
      const byIndex = new Map<number, { focusX: number; scale: number }>();

      for (const entry of framing?.segments ?? []) {
        const segment = short.segments[entry.index];

        if (!segment || byIndex.has(entry.index)) {
          continue;
        }

        if (
          Math.abs(entry.start - segment.start) > ECHO_TOLERANCE_SECONDS ||
          Math.abs(entry.end - segment.end) > ECHO_TOLERANCE_SECONDS
        ) {
          continue;
        }

        byIndex.set(entry.index, {
          focusX: Math.min(1, Math.max(0, entry.focusX)),
          scale: Math.min(1, Math.max(0, entry.scale)),
        });
      }

      return {
        ...short,
        segments: short.segments.map((segment, index) => {
          const framed = byIndex.get(index);

          if (!framed) {
            segmentsSkipped += 1;
            return segment;
          }

          segmentsUpdated += 1;
          return { ...segment, focusX: framed.focusX, scale: framed.scale };
        }),
      };
    }),
  });

  fs.writeFileSync(instructionsPath, JSON.stringify(updated, null, 2), "utf-8");

  console.log(
    `Visual framing: ${segmentsUpdated} segments framed, ${segmentsSkipped} left at default across ${instructions.shorts.length} shorts.`,
  );

  return {
    shortsProcessed: instructions.shorts.length,
    segmentsUpdated,
    segmentsSkipped,
  };
}
