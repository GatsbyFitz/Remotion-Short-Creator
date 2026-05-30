import { generateText, Output } from "ai";
import { z } from "zod";
import fs from "fs";

export async function generateRemotionInstructions(project: string) {
  "use step";


  const transcriptPath = `public/projects/${project}/transcript.json`;

  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`Transcript file not found at path: ${transcriptPath}`);
  }

  const transcriptData = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));

  const InstructionsSchema = z.object({
    shots: z.array(
      z.object({
        startSec: z.number(),
        endSec: z.number(),
        caption: z.string().optional(),
        edit: z.enum(["cut", "trim", "zoom", "pan"]).optional(),
        transition: z.enum(["cut", "fade", "crossfade"]).optional(),
        notes: z.string().optional(),
      })
    ),
    metadata: z
      .object({
        sourceFilename: z.string().optional(),
        compositionId: z.string().optional(),
        fps: z.number().optional(),
      })
      .optional(),
  });

  const prompt = `Given the transcript, produce object matching the Instructions schema. 
  
  Requirements: 
    - Create shorts that perform on social: ideal length 30-45s (max 60s).
    - Each shot: 6-20s; include startSec,endSec,caption (1-2 lines), edit, transition, notes.
    - First shot must include a 'hook' within first 3 seconds.
    - Keep captions short, use present-tense, include suggested on-screen text.
    - Max shots: 8.
  
    Transcript: ${JSON.stringify(transcriptData)}`;

  try {
    const result = await generateText({
      model: "anthropic/claude-opus-4.8",
      prompt,
      output: Output.object({ schema: InstructionsSchema }),
    });

    console.log("Raw generated instructions:", result);


    const RemotionInstructions = result._output



    return { RemotionInstructions }

  } catch (err) {
    console.error("generateRemotionInstructions error:", err);
    throw err;
  }
}