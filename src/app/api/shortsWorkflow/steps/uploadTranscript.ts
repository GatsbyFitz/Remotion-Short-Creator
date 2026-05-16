import { put } from "@vercel/blob";


export async function uploadTranscript(transcriptData: Object, filePath: string) {
  "use step";

const { url } = await put(filePath, JSON.stringify(transcriptData, null, 2), { access: 'public', allowOverwrite: true });

return { url };
}

