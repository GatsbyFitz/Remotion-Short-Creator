import { z } from "zod";
import { CompositionProps } from "./constants";

export const RenderRequest = z.object({
  id: z.string(),
  inputProps: CompositionProps,
});

export type RenderResponse =
  | {
      type: "error";
      message: string;
    }
  | {
      type: "done";
      url: string;
      size: number;
    };

export type SSEMessage =
  | { type: "phase"; phase: string; progress: number; subtitle?: string }
  | { type: "done"; url: string; size: number }
  | { type: "error"; message: string };

// Transcription types
export const Caption = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  confidence: z.number().optional(),
});

export type Caption = z.infer<typeof Caption>;

export const TranscriptData = z.object({
  captions: z.array(Caption),
  language: z.string().optional(),
  duration: z.number(),
});

export type TranscriptData = z.infer<typeof TranscriptData>;


