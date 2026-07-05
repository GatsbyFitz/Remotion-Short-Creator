import { experimental_transcribe as transcribe } from "ai";
import { openai } from '@ai-sdk/openai';
import path from "path";
import fs from "fs";
import { openAiWhisperApiToCaptions } from "@remotion/openai-whisper";

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

  // Need to make audio.mp4 creation a client side activity with 64Kbps bitrate to ensure it stays under 25MB for transcription and compression. Use Mediabunny to create the audio.mp4 from the source video on

  const audioBuffer = fs.readFileSync(audioPath);
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
