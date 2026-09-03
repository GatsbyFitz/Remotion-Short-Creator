import { experimental_transcribe as transcribe } from "ai";
import { openai } from '@ai-sdk/openai';
import path from "path";
import fs from "fs";
import { openAiWhisperApiToCaptions } from "@remotion/openai-whisper";

type WhisperWord = { word: string; start: number; end: number };
type WhisperTranscription = {
  text: string;
  words: WhisperWord[];
  language: string;
  duration: number | string;
  task?: "transcribe";
};
type Caption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
};

// Whisper loops on non-speech audio ("Day 1 Day 1 Day 1 ...", "♪♪ ♪♪ ♪♪") and pads
// the gaps with long whitespace runs. openAiWhisperApiToCaptions() only tolerates
// up to 4 leading whitespace chars per word and throws otherwise, so collapse every
// whitespace run in `text` to a single space before handing it over. `words` is left
// as-is; the API already keeps it consistent with `text`, and collapsing the runs is
// enough to get past the parser.
const collapseWhitespace = (
  transcription: WhisperTranscription,
): WhisperTranscription => ({
  ...transcription,
  text: transcription.text.replace(/\s+/g, " ").trimStart(),
});

const normalizeCaptionText = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

// Collapse repetition-loop hallucinations: any block of 1..8 consecutive captions
// that repeats >= 4 times in a row is reduced to a single occurrence. Also drops
// captions that normalize to nothing (music markers, stray punctuation). The kept
// caption keeps its real timing; the silent stretch the loop covered just becomes a
// gap, which is what it actually was.
const stripRepeatedCaptions = (captions: Caption[]): Caption[] => {
  const MAX_PERIOD = 8;
  const MIN_REPEATS = 4;
  const norm = captions.map((c) => normalizeCaptionText(c.text));
  const kept: Caption[] = [];

  let i = 0;
  while (i < captions.length) {
    if (norm[i] === "") {
      i += 1;
      continue;
    }

    let period = 0;
    let repeats = 0;
    for (let p = 1; p <= Math.min(MAX_PERIOD, captions.length - i); p += 1) {
      let r = 1;
      while (
        i + (r + 1) * p <= captions.length &&
        Array.from({ length: p }).every(
          (_, j) => norm[i + j] !== "" && norm[i + j] === norm[i + r * p + j],
        )
      ) {
        r += 1;
      }
      if (r >= MIN_REPEATS) {
        period = p;
        repeats = r;
        break;
      }
    }

    if (period > 0) {
      for (let j = 0; j < period; j += 1) kept.push(captions[i + j]);
      i += repeats * period;
    } else {
      kept.push(captions[i]);
      i += 1;
    }
  }

  return kept;
};

export async function transcribeVideoFile(project: string) {
  "use step";
  
  const inputDir = path.join(process.cwd(), 'public', 'projects');

  const projectDir = path.join(inputDir, project);
  
  const audioPath = path.join(projectDir, 'audio.mp4');

  if (!fs.existsSync(audioPath)) {
    throw new Error(`Expected audio source file missing at: ${audioPath}`);
  }

  const stat = fs.statSync(audioPath);
  if (!stat || stat.size === 0) {
    throw new Error('Target audio.mp4 file is missing or empty');
  }

  const MAX_SIZE_BYTES = 25 * 1024 * 1024; 
  if (stat.size > MAX_SIZE_BYTES) {
    throw new Error(
      `The audio.mp4 file (${(stat.size / 1024 / 1024).toFixed(2)}MB) exceeds Whisper's 25MB limit.`
    );
  }

  console.log(`Loading audio.mp4 directly into memory. Size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

  const audioBuffer = fs.readFileSync(audioPath);
  const result = await transcribe({
    model: openai.transcription('whisper-1'),
    audio: new Uint8Array(audioBuffer),
    providerOptions: {
      openai: {
        response_format: 'verbose_json',
        language: 'en',
        timestampGranularities: ['word', 'segment'],
      },
    },
  });

  const transcriptData = JSON.parse(JSON.stringify(result));

  const transcription = transcriptData.responses?.[0]?.body as
    | WhisperTranscription
    | undefined;
  if (!transcription?.words?.length) {
    throw new Error('Missing word-level timestamps from Whisper response');
  }

  // Keep the raw response around for debugging bad transcripts.
  const transcriptPath = path.join(projectDir, `transcript.json`);
  fs.writeFileSync(transcriptPath, JSON.stringify(transcription, null, 2));

  let captions: Caption[] = [];
  try {
    const parsed = openAiWhisperApiToCaptions({
      transcription: collapseWhitespace(transcription),
    });
    const before = parsed.captions.length;
    captions = stripRepeatedCaptions(parsed.captions as Caption[]);
    if (captions.length !== before) {
      console.warn(
        `Dropped ${before - captions.length}/${before} caption tokens from ${project} as Whisper repetition-loop hallucinations.`,
      );
    }
  } catch (err) {
    // A malformed transcript shouldn't kill the whole workflow — ship no captions
    // for this project and let the render fall back to an empty caption track.
    console.error(
      `Failed to convert Whisper output to captions for ${project}; writing empty caption track.`,
      err,
    );
    captions = [];
  }

  const captionsPath = path.join(projectDir, `video-captions.json`);
  fs.writeFileSync(captionsPath, JSON.stringify(captions, null, 2));

  return;
}
