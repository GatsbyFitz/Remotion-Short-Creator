# Remotion Shorts Workflow (Next.js + Workflow + Mediabunny)

This project is a local-first workflow for:
- Uploading an MP4
- Creating a project under `public/projects/{projectId}`
- Extracting frames and audio
- Generating AI instructions for shorts
- Rendering with Remotion (using the Remotion Studio)

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Remotion 4
- Vercel Workflow (`workflow` package)
- Mediabunny
- AI SDK (`ai`) + OpenAI transcription provider
- pnpm

## Prerequisites

- Node.js 20+
- pnpm 9+ (or newer)
- macOS, Linux, or Windows

Optional:
- Bun (only needed for `pnpm create-snapshot`)

## 1) Install dependencies

```bash
pnpm install
```

## 2) Configure environment variables

Create `.env.local` in the project root.

Minimum commonly needed values:

```bash
# Required for Whisper transcription in transcribeVideoFile.ts
OPENAI_API_KEY=your_openai_key
```

If you are using AI Gateway model IDs (for example `google/gemini-3-flash`), also configure your gateway/provider credentials according to your AI SDK setup.

```bash
# Required to use the Vercel AI Gateway
VERCEL_OIDC_TOKEN=your_vercel_oidc_token
```

## 3) Run locally

You can run all key processes with one command:

```bash
pnpm ready
```

This starts:
- Next.js app on http://localhost:3000
- Remotion Studio on http://localhost:3001
- Workflow web runtime

Alternative (separate terminals):

```bash
pnpm dev
pnpm remotion
workflow web
```

## 4) Cleaning Up

Included is a set of compositions that I have been messing around with, feel free to remove these folders and the root file import. The only one related to short creation is the shortCreator composition.

## Local Development Flow

1. Open the app at http://localhost:3000
2. Upload an MP4 and create a project
3. The app uploads chunks, finalizes the project, extracts frames/audio, and creates a frames manifest
4. Trigger workflow actions from the project card

Project artifacts are written to:

- `public/projects/{projectId}/video.mp4`
- `public/projects/{projectId}/audio.mp4`
- `public/projects/{projectId}/frames/`
- `public/projects/{projectId}/frames-manifest.json`
- `public/projects/{projectId}/transcript.json`
- `public/projects/{projectId}/instructions.json`
- `public/projects/{projectId}/youtube_chapters.txt`
- `public/projects/{projectId}/metadata.json`

## Useful Scripts

```bash
pnpm dev              # Next.js only
pnpm remotion         # Remotion Studio only
pnpm ready            # Next + Remotion + workflow web
pnpm lint             # ESLint
pnpm build            # Production build
pnpm start            # Start production server
pnpm render           # Remotion render
```
