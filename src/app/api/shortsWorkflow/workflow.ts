
export async function shortsWorkflow(project: string, action: string) {
  'use workflow';

  console.log("Workflow started for project:", project);

  if (action == 'runShortsWorkflow') {
    const { transcribeVideoFile } = await import('./steps/transcribeVideoFile');
    await transcribeVideoFile(project);
  }

  if ( action === 'runShortsWorkflow' || action === 'regenerateInstructions') {
    const { generateNarrativeCandidates } = await import('./steps/generateNarrativeCandidates');
    const { generateInstructionsSkeleton } = await import('./steps/generateInstructionsSkeleton');
    const { finalizeRemotionInstructions } = await import('./steps/finalizeRemotionInstructions');

    const narrative = await generateNarrativeCandidates(project);
    const skeleton = await generateInstructionsSkeleton(
      narrative.cleansegments,
      narrative.pass1Candidates,
      narrative.visualCandidates,
    );
    await finalizeRemotionInstructions(
      project,
      narrative.cleansegments,
      narrative.words,
      narrative.videoDuration,
      narrative.frames,
      skeleton,
      narrative.visualCandidates,
    );

    // Framing QA runs last, against the final snapped segments.
    const { generateVisualFraming } = await import('./steps/generateVisualFraming');
    await generateVisualFraming(project);
  }

  // Re-run just the framing QA over an existing instructions.json, without
  // regenerating any timing or narrative.
  if (action === 'refineVisualFraming') {
    const { generateVisualFraming } = await import('./steps/generateVisualFraming');
    await generateVisualFraming(project);
  }

  if (action === 'generateYoutubeChapters') {
    const { generateYouTubeChapters } = await import("./steps/generateYoutubeChapters");
    await generateYouTubeChapters(project);
  }

}

