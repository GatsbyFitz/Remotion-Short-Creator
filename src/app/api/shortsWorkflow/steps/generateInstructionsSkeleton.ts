import { generateText, Output } from "ai";
import {
  TranscriptSegment,
  NarrativeCandidate,
  VisualCandidate,
  Skeleton,
  pass2Prompt,
  SkeletonSchema,
} from "./instructionsShared";

// Pass 2: select the strongest narratives from pass 1 and lay out a segment
// skeleton (timings + purpose, no transitions yet). Kept as its own step so a
// pass 3 failure doesn't force pass 1/2 to rerun.
export async function generateInstructionsSkeleton(
  cleansegments: TranscriptSegment[],
  pass1Candidates: NarrativeCandidate[],
  visualCandidates: VisualCandidate[],
): Promise<Skeleton> {
  "use step";

  const pass2 = await generateText({
    model: "google/gemini-3.7-flash",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: pass2Prompt(cleansegments, pass1Candidates, visualCandidates),
          },
        ],
      },
    ],
    output: Output.object({ schema: SkeletonSchema }),
  });

  console.log("Pass 2 shorts:", pass2.output.shorts.length);

  return pass2.output;
}
