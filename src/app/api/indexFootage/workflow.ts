export async function indexFootageWorkflow(project: string) {
  'use workflow';

  console.log("Footage indexing started for project:", project);

  const { indexVideoFrames } = await import('./steps/indexVideoFrames');
  await indexVideoFrames(project);
}
