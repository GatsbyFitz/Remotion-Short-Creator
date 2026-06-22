export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { TranscribeRequest } from "../../../../types/schema";
import { experimental_transcribe as transcribe } from "ai";
import { openai} from '@ai-sdk/openai';
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

export async function POST(request: NextRequest) {
  console.log("Transcribe API called");
  
  try {
    const body = await request.json();
    console.log("Request body:", body);
    
    const { videoFilename } = TranscribeRequest.parse(body);
    console.log("Parsed videoFilename:", videoFilename);

    // Build path to input video
    const inputDir = path.join(process.cwd(), "input");
    const videoPath = path.join(inputDir, videoFilename);
    console.log("Video path:", videoPath);


    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      console.error("Video file not found:", videoPath);
      return NextResponse.json(
        { error: `Video file not found: ${videoFilename}` },
        { status: 404 }
      );
    }

    const outPath = path.join(inputDir, `${path.parse(videoFilename).name}-audio.mp4`);
    const input = new Input({ source: new FilePathSource(videoPath), formats: [MP4] });
    const output = new Output({ format: new Mp4OutputFormat(), target: new FilePathTarget(outPath) });

    const conversion = await Conversion.init({
      input,
      output,
      video: { discard: true }, // drop video
      audio: {}                  // empty = copy audio track(s) if compatible
    });

    console.log('isValid', conversion.isValid, 'discarded', conversion.discardedTracks);

    await conversion.execute();


    console.log(`Starting transcription for: ${videoFilename}`);

    // Read the audio file as a buffer
    const audioBuffer = fs.readFileSync(outPath);
    
    // Transcribe using Vercel AI SDK with OpenAI Whisper
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

    console.log("Transcription complete");


    // Save transcript to JSON file
    const outputPath = path.join(
      inputDir,
      `${path.parse(videoFilename).name}-transcript.json`
    );
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`Transcript saved to: ${outputPath}`);

    return NextResponse.json({
      success: true,
      transcriptPath: outputPath,
      transcriptData: result,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Transcription failed",
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
}

