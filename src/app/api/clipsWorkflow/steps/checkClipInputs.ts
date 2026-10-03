import fs from "fs";

// Fails fast on a project that can't produce clips, and reports whether the
// transcript already exists. Projects that have been through the shorts
// workflow are already transcribed, so there's no need to pay for Whisper again.
export async function checkClipInputs(project: string) {
  "use step";

  const projectDir = `public/projects/${project}`;

  if (!fs.existsSync(`${projectDir}/video.mp4`)) {
    throw new Error(`Source video not found at path: ${projectDir}/video.mp4`);
  }

  if (!fs.existsSync(`${projectDir}/frames-manifest.json`)) {
    throw new Error(`Frames manifest file not found at path: ${projectDir}/frames-manifest.json`);
  }

  // Both come out of the same transcription step: transcript.json drives clip
  // selection and video-captions.json drives the burned-in subtitles.
  const hasTranscript =
    fs.existsSync(`${projectDir}/transcript.json`) && fs.existsSync(`${projectDir}/video-captions.json`);

  return { hasTranscript };
}
