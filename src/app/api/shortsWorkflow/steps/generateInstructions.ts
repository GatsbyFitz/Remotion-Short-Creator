import { generateText, Output } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "path/win32";

export async function generateRemotionInstructions(project: string) {
  "use step";


  const transcriptPath = `public/projects/${project}/transcript.json`;

  const framesPath = `public/projects/${project}/frames-manifest.json`;
  const framesManifest = JSON.parse(fs.readFileSync(framesPath, "utf-8"));

  const frames = Array.isArray(framesManifest?.frames) ? framesManifest.frames : [];

  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`Transcript file not found at path: ${transcriptPath}`);
  }

  const transcriptData = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));
  
  const segments = Array.isArray(transcriptData?.segments)
  ? transcriptData.segments
  : [];

  const cleansegments = segments.map((segment: { start: number; end: number; text: string }) => ({
    start: Math.round(segment.start * 1000) / 1000,
    end: Math.round(segment.end * 1000) / 1000,
    text: segment.text.replace(/\./g, "").replace(/\s+/g, " ").trim(),
  }));

  const InstructionsSchema = z.object({
    shorts: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        segments: z.array(
          z.object({
            start: z.number(),
            end: z.number(),
            effect: z.enum(["grayscale", "invert", "scale"]).optional(),
            transition: z.enum(["fade", "slide", "wipe", "flip", "iris", "clockWipe"]).optional(),
          })
        ),
      })
    ).min(5).max(7),
  });


const frameParts = frames.map((frame: { relativePath: string }) => ({
    type: "image" as const,
    image: fs.readFileSync(path.join("public", frame.relativePath)),
    mediaType: "image/jpeg",
  }));

const promptText = `Given the transcript and the available frames, produce object matching the Instructions schema.

Requirements:
- Use frames as visual guidance for story selection and short construction.
- Do not return frame data in the output.
- Create shorts that perform on social: ideal length 30-45s (max 55s).
- Each short should include 2-4 segments when possible.
- Each segment: 6-20s; include start,end.
- Suggest effects for each segment based on the content.
- Choose a transition between segments, default to fade.
- Rarely apply an effect

Transcript:
${JSON.stringify(cleansegments)}

Frames:
${JSON.stringify(frames.map((frame: { second: number; relativePath: string }) => ({
  second: frame.second,
  relativePath: frame.relativePath,
})))}`;

  try {
    const result = await generateText({
      model: "google/gemini-3-flash",
       messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptText,
            },
            ...frameParts,
          ],
        },
      ],
      output: Output.object({ schema: InstructionsSchema }),
    });

    console.log("Raw generated instructions:", result);


    const RemotionInstructions = result._output

    fs.writeFileSync(`public/projects/${project}/instructions.json`, JSON.stringify(RemotionInstructions, null, 2), "utf-8");

    return { RemotionInstructions }

  } catch (err) {
    console.error("generateRemotionInstructions error:", err);
    throw err;
  }
}