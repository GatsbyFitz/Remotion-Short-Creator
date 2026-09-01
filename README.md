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

## Rendering on the server

Shorts can be rendered headlessly through the API, so upload → generate → render
→ upload to YouTube all happen on the box. The Remotion Studio is optional and
only needed for hand-editing.

In the UI, each short has a **Render** button and there is a **Render all** for
the whole project. Progress is polled, not streamed, so closing the tab or
losing signal on a phone does not affect a running render — reopen the project
and the progress is still there.

### API

```bash
# Queue one short (omit shortId to queue every short in the project)
curl -X POST localhost:3000/api/render \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"my-project","shortId":"my-short"}'

curl "localhost:3000/api/render?jobId=<id>"          # one job
curl "localhost:3000/api/render?projectId=<id>"      # all jobs for a project
curl -X DELETE "localhost:3000/api/render?jobId=<id>"  # cancel
```

Finished files land in `out/ShortCreator-<shortId>-<index>.mp4` — the same
naming the Studio uses, which is what `/api/uploadToYoutube` looks for. They are
served back at `/api/render/file/<filename>` (Range requests supported, so they
are seekable in a browser).

Notes:
- Renders run **one at a time**. `RENDER_CONCURRENCY` controls threads *within*
  a render, not how many run at once.
- The Remotion bundle is built once per process and reused. **Restart the server
  after editing a composition**, or renders keep using the old bundle.
- Jobs live in memory, so a restart loses their history. Finished `.mp4` files
  are unaffected.

## Deploying to a server

A 2 vCPU / 4GB VPS is enough (Hetzner CX22 or CAX11, ~€4/mo).

```bash
git clone <your-repo> && cd Remotion-Short-Creator
cp .env.example .env      # fill in OPENAI_API_KEY etc.
mkdir -p data/projects data/out data/miscellaneous
cp /path/to/profile.jpg data/miscellaneous/   # required, see below
docker compose up -d --build
```

`docker-compose.yml` binds to `127.0.0.1:3000` deliberately — **the app has no
authentication of any kind**. Reach it with [Tailscale](https://tailscale.com)
(free, nothing to configure in the app), an SSH tunnel
(`ssh -L 3000:localhost:3000 user@server`), or a reverse proxy that terminates
TLS and handles auth. Do not publish the port as-is.

Two directories must survive a redeploy, and both are bind-mounted to `./data`:
`public/projects` (all project data) and `out` (rendered videos).

### Gotchas worth knowing before the first deploy

- **`public/miscellaneous/profile.jpg` is gitignored.** The end screen loads it,
  and a render fails without it. Copy it to `data/miscellaneous/` — `/api/render`
  checks for it up front and returns a clear error rather than dying mid-render.
- **The source video is uploaded whole.** Frame and audio extraction happen in
  your browser (mediabunny/WebCodecs), but `video.mp4` is still transferred to
  the server, so a 2GB recording takes as long as your upload link allows.
- **Disk fills fast.** Each project keeps the source video plus a JPEG every 3
  seconds. 40GB does not go far — prune old projects.
- **Env vars must be set at runtime, not build time.** They are read through
  `src/lib/env.ts` for exactly this reason; Next inlines literal
  `process.env.FOO` at build time, which would bake build-time values into the
  image.

### Running the Remotion Studio against the server (optional)

The Studio is a dev server and is not in the Docker image. To hand-edit against
server data, run it locally and point it at the server:

```bash
REMOTION_APP_URL=http://<server>:3000 pnpm remotion
```

and set `REMOTION_STUDIO_ORIGIN` on the server so CORS allows it.

## Useful Scripts

```bash
pnpm dev              # Next.js only
pnpm remotion         # Remotion Studio only
pnpm ready            # Next + Remotion + workflow web
pnpm lint             # ESLint
pnpm build            # Production build
pnpm start            # Start production server
pnpm render           # Remotion render (CLI)
```
