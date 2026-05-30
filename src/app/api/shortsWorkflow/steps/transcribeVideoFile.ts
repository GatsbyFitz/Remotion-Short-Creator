import { experimental_transcribe as transcribe } from "ai";
import { openai } from '@ai-sdk/openai';
import path from "path";
import fs from "fs";
import {
  Input,
  Output,
  Conversion,
  FilePathSource,
  FilePathTarget,
  Mp4OutputFormat,
  MP4,
} from 'mediabunny';
import { openAiWhisperApiToCaptions } from "@remotion/openai-whisper";

export async function transcribeVideoFile(project: string) {
  "use step";
  
  const inputDir = path.join(process.cwd(), 'public', 'projects');

  const projectDir = path.join(inputDir, project);
  const videoFile = fs
    .readdirSync(projectDir)
    .find((file) => file.toLowerCase().endsWith(".mp4"));

  if (!videoFile) {
    throw new Error(`No .mp4 file found in: ${projectDir}`);
  }

  const videoPath = path.join(projectDir, videoFile);

  const outPath = path.join(projectDir, `audio.mp4`);
  const input = new Input({ source: new FilePathSource(videoPath), formats: [MP4] });
  const output = new Output({ format: new Mp4OutputFormat(), target: new FilePathTarget(outPath) });

  const conversion = await Conversion.init({
    input,
    output,
    video: { discard: true },
    audio: {}, // copy audio tracks if compatible (no encoder required)
  });

  await conversion.execute();

  const stat = fs.statSync(outPath);
  if (!stat || stat.size === 0) throw new Error('Converted audio missing or empty');

  const audioBuffer = fs.readFileSync(outPath);
  const result = await transcribe({
    model: openai.transcription('whisper-1'),
    audio: new Uint8Array(audioBuffer),
    providerOptions: {
      openai: {
        response_format: 'verbose_json',
        language: 'en',
        timestampGranularities: ['word'],
      },
    },
  });

  const transcriptData = JSON.parse(JSON.stringify(result));

  const transcription = transcriptData.responses?.[0]?.body;
    if (!transcription?.words?.length) {
      throw new Error('Missing word-level timestamps from Whisper response');
    }

  const transcriptPath = path.join(projectDir, `transcript.json`);
  fs.writeFileSync(transcriptPath, JSON.stringify(transcriptData, null, 2));

  const {captions} = openAiWhisperApiToCaptions({transcription});

  const captionsPath = path.join(projectDir, `video-captions.json`);
  fs.writeFileSync(captionsPath, JSON.stringify(captions, null, 2));


  return;
}
