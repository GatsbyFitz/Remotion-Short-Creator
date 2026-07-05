
export async function shortsWorkflow(project: string, action: string) {
  'use workflow';

  console.log("Workflow started for project:", project);

  if (action == 'runShortsWorkflow') {
    const { transcribeVideoFile } = await import('./steps/transcribeVideoFile');
    await transcribeVideoFile(project);
  }

  if ( action === 'runShortsWorkflow' || action === 'regenerateInstructions') {
  const { generateRemotionInstructions } = await import('./steps/generateInstructions');
  await generateRemotionInstructions(project);
  }

  if (action === 'generateYoutubeChapters') {
    const { generateYouTubeChapters } = await import("./steps/generateYoutubeChapters");
    await generateYouTubeChapters(project);
  }

}

