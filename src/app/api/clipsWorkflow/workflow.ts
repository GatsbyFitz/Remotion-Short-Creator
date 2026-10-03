export async function clipsWorkflow(project: string) {
  'use workflow';

  console.log("Clips workflow started for project:", project);

  const { checkClipInputs } = await import('./steps/checkClipInputs');
  const { scanVisualMoments } = await import('./steps/scanVisualMoments');
  const { selectClipCandidates } = await import('./steps/selectClipCandidates');
  const { rankAndSaveClips } = await import('./steps/rankAndSaveClips');
  const { transcribeVideoFile } = await import('../shortsWorkflow/steps/transcribeVideoFile');

  const { hasTranscript } = await checkClipInputs(project);

  // The visual scan only needs frames, so it runs alongside transcription
  // rather than waiting on it.
  const [visualMoments] = await Promise.all([
    scanVisualMoments(project),
    hasTranscript ? Promise.resolve() : transcribeVideoFile(project),
  ]);

  const { videoPayoff, candidates } = await selectClipCandidates(project, visualMoments);
  await rankAndSaveClips(project, candidates, videoPayoff);
}
