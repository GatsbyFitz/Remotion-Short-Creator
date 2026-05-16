import { Sandbox } from '@vercel/sandbox';



export async function renderShot(instructionsData: any) {
  "use step";

  const sandbox = await Sandbox.create();
  const result = await sandbox.runCommand('echo', ['Hello from Vercel Sandbox!']);
  console.log(await result.stdout());

  console.log("Starting video rendering with instructions:", instructionsData);

  await addBundleToSandbox({
  sandbox,
  bundleDir: '/path/to/bundle',
});

https://www.remotion.dev/docs/vercel/add-bundle-to-sandbox

//renderMediaOnVercel()

//uploadToVercelBlob()

  await sandbox.stop();

}