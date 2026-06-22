
import { put } from "@vercel/blob";


export async function uploadRemotionInstructions(instructions: any, filePath: string) {
  "use step";

const { url } = await put(filePath, JSON.stringify(instructions, null, 2), { access: 'public', allowOverwrite: true });

return { url };
}
