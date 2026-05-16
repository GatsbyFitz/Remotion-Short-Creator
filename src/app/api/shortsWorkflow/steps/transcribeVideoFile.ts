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

export async function transcribeVideoFile(videoFilename: string) {
  "use step";
  
  const inputDir = path.join(process.cwd(), 'input');
  const videoPath = path.join(inputDir, videoFilename);
  if (!fs.existsSync(videoPath)) throw new Error(`Video not found: ${videoFilename}`);

  const outPath = path.join(inputDir, "audio", `${path.parse(videoFilename).name}-audio.mp4`);
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
        language: 'en',
        timestampGranularities: ['word', 'segment'],
      },
    },
  });

  const transcriptData = JSON.parse(JSON.stringify(result));

  const transcriptPath = path.join(inputDir, `${path.parse(videoFilename).name}-transcript.json`);
  fs.writeFileSync(transcriptPath, JSON.stringify(transcriptData, null, 2));
  return { transcriptPath, transcriptData };
}
