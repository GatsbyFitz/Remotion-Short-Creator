
export async function shortsWorkflow(project: string, action?: string) {
  'use workflow';

  console.log("Workflow started for project:", project);

  if (action == 'runShortsWorkflow') {
    const { transcribeVideoFile } = await import('./steps/transcribeVideoFile');
    await transcribeVideoFile(project);
  }
  

  //const {uploadTranscript} = await import('./steps/uploadTranscript');
  //const {url} = await uploadTranscript(transcriptData, `transcripts/${videoFilename.replace('.MP4', '').replace('.mp4', '')}.txt`);

  //console.log("Transcript uploaded. URL:", url);

  //const url = "https://q0yylzbywwxjdvqd.public.blob.vercel-storage.com/transcripts/video.txt"

  //const { fetchTranscriptData } = await import('./steps/fetchTranscript');

  //const transcriptResponse = await fetchTranscriptData(url);

  // if (!transcriptResponse.ok) {
  //   throw new Error(`Failed to fetch transcript data from URL: ${url}`);
  // }

  // const transcriptDataFetched = await transcriptResponse.json();

  // console.log("Transcription completed. Transcript path:", transcriptDataFetched);

  if (action === 'normaliseVideo') {
  const { normaliseVideo } = await import("./steps/normaliseVideo");
  await normaliseVideo(project);
  }

  if (action === 'generateFrames') {
  const {generateFrames} = await import('./steps/generateFrames');
  await generateFrames(project);
  }

  //const { generateRemotionInstructions } = await import('./steps/generateInstructions');
  //await generateRemotionInstructions(project);

  //console.log("Generated Remotion instructions:", RemotionInstructions);

  //const { uploadRemotionInstructions } = await import('./steps/uploadInstructions');

  ///const { url: instructions_url } = await uploadRemotionInstructions(RemotionInstructions, `instructions/${videoFilename.replace('.MP4', '').replace('.mp4', '')}.txt`);

  //console.log("Remotion instructions saved. URL:", instructions_url);

  //const instructions_url = "https://q0yylzbywwxjdvqd.public.blob.vercel-storage.com/instructions/video.txt";

  //const { fetchInstructions } = await import('./steps/fetchInstructions');
  
  //const instructionsResponse = await fetchInstructions(instructions_url);

  //if (!instructionsResponse.ok) {
  //  throw new Error(`Failed to fetch instructions from URL: ${instructions_url}`);
  //}

  //const instructionsData = await instructionsResponse.json();

  //console.log("Fetched Remotion instructions:", instructionsData);

  //const { createClientPackage } = await import('./steps/createClientPackage');

  //const clientPackage = await createClientPackage(instructionsData);

  //return clientPackage;
}

