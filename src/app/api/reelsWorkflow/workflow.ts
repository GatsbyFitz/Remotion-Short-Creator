export async function reelsWorkflow(project: string, action: string) {
  'use workflow';

  console.log("Reels workflow started for project:", project, action);

  const { importAlbum } = await import('./steps/importAlbum');
  const { analyseMedia } = await import('./steps/analyseMedia');
  const { researchTrends } = await import('./steps/researchTrends');
  const { planReels } = await import('./steps/planReels');
  const { markReelsFailed } = await import('./steps/markReelsFailed');

  try {
    // "replan" skips straight to fresh trend research over the media already
    // imported and analysed.
    if (action === 'create') {
      await importAlbum(project);
      await analyseMedia(project);
    }

    const research = await researchTrends(project);
    await planReels(project, research);
  } catch (err) {
    await markReelsFailed(project, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
