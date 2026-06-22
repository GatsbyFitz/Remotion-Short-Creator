import {get} from "@vercel/blob";
import { NextResponse } from "next/dist/server/web/spec-extension/response";

export async function fetchInstructions(url: string) {
  "use step";

  const result = await get(url, { access: 'public' });

  if (result?.statusCode !== 200) {
    return new NextResponse('Not found', { status: 404 });
  }
 
  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
    },
  })
}