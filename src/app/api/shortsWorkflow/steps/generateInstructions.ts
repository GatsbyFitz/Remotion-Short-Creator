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
    shorts: z.array(
      z.object({
        id: z.string(),
        segments: z.array(
          z.object({
            start: z.number(),
            end: z.number(),
            effect: z.enum(["grayscale", "invert", "scale"]).optional(),
          })
        ),
      })
    ),
  });

  const availableEffects = [
    "grayscale",
    "invert",
    "scale",
  ];


  const prompt = `Given the transcript, produce object matching the Instructions schema. 
  
  Requirements: 
    - Create shorts that perform on social: ideal length 30-45s (max 55s). A short is made up of one or more segments from the transcript.
    - Each segment: 6-20s; include start,end.
    - Suggest effects for each segment based on the content to amplify the message. Use a max of 3. Available effects: ${availableEffects.join(", ")}. Only include an effect if it meaningfully enhances the content.
    - Max shorts: 7.
  
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