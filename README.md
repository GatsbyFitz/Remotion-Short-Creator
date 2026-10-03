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
- `public/projects/{projectId}/clips.json`
- `public/projects/{projectId}/metadata.json`

## Social Clips

The **Generate Social Clips** action picks 5–8 teaser clips (5–15s each) from the full video, geared to making viewers want to watch the whole thing. It reuses the project's transcript if one exists, scores sampled frames for visual interest, proposes candidates from the transcript plus those scores, then reviews each candidate against its own frames and keeps the best. Results land in `clips.json`, best first, each with a hook, what it leaves open, and a caption to post.

Each clip is registered in Remotion Studio under the **Clips** folder (`SocialClip-*`), at the source video's aspect ratio with burned-in subtitles. Render from there; the project's 2x scale means a landscape clip renders at 3840x2160 unless you pass `--scale=1`.

## Reels from a Photos Album

The **Reels Workflow** tile turns an Apple Photos album (or any folder of photos and clips) into 3–5 vertical reels built on formats trending right now. macOS only: it drives Photos through AppleScript and converts media with the built-in `sips` and `avconvert`.

1. **Import** — exports up to 120 items (favourites first) from the album, converting HEIC to JPEG and iPhone HEVC/HDR clips to SDR H.264. The first run asks for permission to control Photos.
2. **Analyse** — describes and scores every photo and clip, notes where the subject sits for the vertical crop, and finds each clip's best moment.
3. **Research** — live web search (OpenAI, needs `OPENAI_API_KEY`) for formats trending on Reels/TikTok that suit the album. If it fails, the reels fall back to evergreen formats and the UI says so.
4. **Plan** — lays out each reel as shots cut on the beat of the sound it was built for, with on-screen text and a post caption.

Reels render silent: trending sounds are licensed, so add the named sound in Instagram's editor. **Regenerate with Fresh Trends** re-runs the research and plan without re-importing. Reels appear in Remotion Studio under the **Reels** folder (`Reel-*`).

Reel projects are written to `public/reels/{projectId}/` (`media/`, `thumbs/`, `media-manifest.json`, `media-analysis.json`, `trends.json`, `reels.json`, `status.json`).

## Footage Library

Every photo, clip and video frame the workflows analyse is stored in one SQLite database, `data/analysis.sqlite` (Node's built-in `node:sqlite`, no setup). Media is identified by content — a photo by a hash of its file, a video frame by its source video's hash plus the timestamp — so the same media is never analysed twice, in any project. The reels analysis and the clips workflow's visual scan both read from it first and only send new media to the model.

The **Footage Library** tile searches all of it by meaning (OpenAI `text-embedding-3-small` embeddings of each description), and can index every frame of a video project rather than the 150 the clips scan samples. Set `ANALYSIS_DB_PATH` to keep the database elsewhere.

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
