import fs from "fs";
import path from "node:path";
import { z } from "zod";
import { toKebab } from "../../shortsWorkflow/steps/instructionsShared";

// Reel projects live apart from the video projects in public/projects: their
// source is a set of photos and clips, not one long video, and none of the
// shorts tooling applies to them.
export const REELS_ROOT = path.join("public", "reels");

export const reelDir = (project: string) => path.join(REELS_ROOT, project);
export const reelPath = (project: string, ...parts: string[]) => path.join(reelDir(project), ...parts);

export const MIN_REELS = 3;
export const MAX_REELS = 5;
export const MIN_REEL_SECONDS = 5;
export const MAX_REEL_SECONDS = 30;

// Tempo used to time cuts when the chosen sound's BPM isn't known.
export const DEFAULT_BPM = 110;

// A Photos album chosen in the picker carries its id and folder path; one typed
// by name has only the name.
export type ReelSource =
  | { kind: "photos"; album: string; albumId?: string; albumPath?: string[] }
  | { kind: "folder"; folder: string };

export type ReelProjectMetadata = {
  projectId: string;
  name: string;
  source: ReelSource;
  createdAt: string;
};

export type ReelStatus = "importing" | "analysing" | "researching" | "planning" | "ready" | "failed";

export type MediaItem = {
  id: string;
  // Relative to the project directory.
  file: string;
  kind: "photo" | "video";
  // Display dimensions, after any EXIF rotation.
  width: number;
  height: number;
  // Videos only, in seconds.
  duration?: number;
  takenAt?: string | null;
  favorite?: boolean;
  originalName: string;
  // Hash of the source file, before conversion: the item's identity in the
  // analysis library. Absent from manifests imported before the library.
  contentKey?: string;
  // Small JPEGs for the analysis pass: one for a photo, a few spread across a video.
  thumbs: Array<{ file: string; second?: number }>;
};

export type MediaManifest = { items: MediaItem[]; skipped: Array<{ name: string; reason: string }> };

export const SHOT_TYPES = ["scenic", "action", "people", "selfie", "group", "detail", "food", "text", "other"] as const;

export type MediaInsight = {
  id: string;
  description: string;
  score: number;
  shotType: (typeof SHOT_TYPES)[number];
  focusX: number;
  bestStart: number | null;
};

export type MediaAnalysis = {
  summary: string;
  niche: string;
  mood: string;
  items: MediaInsight[];
};

export type TrendSound = { title: string; artist: string; bpm: number | null; note: string };

export type Trend = {
  id: string;
  name: string;
  whyNow: string;
  structure: string;
  textStyle: string;
  typicalSeconds: number;
  sounds: TrendSound[];
  sourceUrls: string[];
  // "web" came out of this run's research; "evergreen" is the built-in fallback.
  origin: "web" | "evergreen";
};

export type TrendResearch = {
  researchedAt: string;
  origin: "web" | "evergreen";
  trends: Trend[];
};

export const MOTIONS = ["none", "zoomIn", "zoomOut", "panLeft", "panRight"] as const;
export const ENTRANCES = ["cut", "punch", "flash"] as const;
export const TEXT_POSITIONS = ["top", "center", "bottom"] as const;

// One shot of a finished plan, with everything the Reel composition needs
// resolved from the manifest so it never has to read project files itself.
export type ReelShot = {
  mediaId: string;
  file: string;
  kind: "photo" | "video";
  width: number;
  height: number;
  beats: number;
  videoStart: number;
  loop: boolean;
  fit: "cover" | "blur";
  focusX: number;
  motion: (typeof MOTIONS)[number];
  entrance: (typeof ENTRANCES)[number];
  text: string | null;
  textPosition: (typeof TEXT_POSITIONS)[number];
};

export type Reel = {
  id: string;
  title: string;
  trendId: string;
  trendName: string;
  sound: { title: string; artist: string; bpm: number | null };
  soundNote: string;
  caption: string;
  bpm: number;
  durationSeconds: number;
  shots: ReelShot[];
};

export const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf-8")) as T;

export const writeJson = (file: string, value: unknown) =>
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf-8");

// The UI reads this to show where a run is up to, or why it stopped.
export const setStatus = (project: string, status: ReelStatus, detail?: string) =>
  writeJson(reelPath(project, "status.json"), {
    status,
    ...(detail ? { detail } : {}),
    updatedAt: new Date().toISOString(),
  });

// Formats that have stayed popular for years. Used when the live research
// fails, and offered alongside it so the plan always has formats it can build.
export const EVERGREEN_TRENDS: Trend[] = [
  {
    id: "photo-dump-beat",
    name: "Photo dump cut to the beat",
    whyNow: "A staple format on Reels for years; works with almost any album.",
    structure:
      "10-20 shots, one cut on every beat (or every half beat in the fastest section). Open on the strongest image with a short hook line, then run the rest without text.",
    textStyle: "One short line on the first shot only, e.g. 'september in the alps' or 'the week I'll never forget'.",
    typicalSeconds: 10,
    sounds: [],
    sourceUrls: [],
    origin: "evergreen",
  },
  {
    id: "text-hook-reveal",
    name: "Text hook, then the reveal",
    whyNow: "Hook-first editing keeps holding viewers past the first second.",
    structure:
      "Hold one teaser shot for 2-3 seconds under a curiosity hook, then cut fast through the payoff shots on the beat.",
    textStyle: "A bold question or claim up top, e.g. 'nobody warned me about day 3'. Payoff shots have no text.",
    typicalSeconds: 12,
    sounds: [],
    sourceUrls: [],
    origin: "evergreen",
  },
  {
    id: "pov-caption",
    name: "POV caption",
    whyNow: "First-person POV framing invites viewers to put themselves in the scene.",
    structure: "3-6 longer shots with gentle motion, one 'POV:' line held across all of them.",
    textStyle: "A single relatable line starting 'POV:', held for the whole reel.",
    typicalSeconds: 9,
    sounds: [],
    sourceUrls: [],
    origin: "evergreen",
  },
  {
    id: "expectation-reality",
    name: "Expectation vs reality",
    whyNow: "Contrast and self-aware humour are reliably shareable.",
    structure: "First half labelled with the expectation, second half with the reality, cutting on the beat drop.",
    textStyle: "Two labels: 'expectation' over the first half, 'reality' over the second.",
    typicalSeconds: 10,
    sounds: [],
    sourceUrls: [],
    origin: "evergreen",
  },
  {
    id: "numbered-list",
    name: "Numbered list",
    whyNow: "List formats promise a payoff, so viewers watch to the end.",
    structure: "A title card, then one shot per item, each with its number and a few words.",
    textStyle: "Title like '5 things I learned on this trip', then '1. ...', '2. ...' per shot.",
    typicalSeconds: 14,
    sounds: [],
    sourceUrls: [],
    origin: "evergreen",
  },
];

export const MediaInsightsSchema = z.object({
  items: z.array(
    z.object({
      index: z.number().int().min(0).describe("The 0-based index of the media item, as labelled in the message."),
      description: z.string().describe("What's in shot, in under 20 words."),
      score: z.number().min(0).max(10).describe("How strong this is as a shot in a reel, 0-10."),
      shotType: z.enum(SHOT_TYPES).describe("The best-fitting kind of shot."),
      focusX: z
        .number()
        .min(0)
        .max(1)
        .describe("Horizontal position of the main subject, 0 = left edge, 1 = right edge. Used to crop to vertical."),
      bestStart: z.number().min(0).nullable().describe(
        "Videos only: the second where the most engaging moment starts. null for photos.",
      ),
    }),
  ),
});

export const mediaInsightsPrompt = (count: number) => `
You are reviewing photos and video clips from someone's photo album, to cut short vertical reels for Instagram.

Return only JSON matching the schema — exactly one entry per media item (${count} items), using the index each item is labelled with. Photos have one image; videos have a few frames, each labelled with its time in seconds.

For each item:
- description: what's in shot, in under 20 words.
- score 0-10: how strong it is as a shot in a reel. High for striking light or scenery, action, emotion, strong composition. Low for blurry, dark, cluttered or near-duplicate shots, screenshots and receipts.
- shotType: the best-fitting category.
- focusX: where the main subject sits horizontally (0 = left edge, 1 = right edge). The reel crops to a tall frame, so this decides what stays in.
- bestStart: for videos, the second where the most engaging moment starts, judged from the frames. null for photos.
`;

export const AlbumSummarySchema = z.object({
  summary: z.string().describe("One or two sentences on what this album is about."),
  niche: z.string().describe("The subject in a few words, e.g. 'alpine trail running trip'."),
  mood: z.string().describe("The overall mood in a few words."),
});

export const albumSummaryPrompt = (descriptions: string[]) => `
These are descriptions of every photo and clip in one album. Say what the album is about.

Return only JSON matching the schema.

${descriptions.map((d) => `- ${d}`).join("\n")}
`;

export const trendResearchPrompt = (today: string, analysis: Pick<MediaAnalysis, "summary" | "niche" | "mood">, mediaMix: string) => `
Today is ${today}. I'm making Instagram Reels from a photo album and want them built on formats that are trending right now.

Album: ${analysis.summary} (subject: ${analysis.niche}; mood: ${analysis.mood}). It contains ${mediaMix}.

Search the web for short-form video formats that are trending on Instagram Reels and TikTok in the last few weeks, and pick the 4-6 that best suit this album. Favour formats that can be built from photos and short clips with on-screen text, rather than ones that need talking to camera or a voiceover.

For each format, report:
- its name and why it's popular right now, with evidence;
- its structure, shot by shot, including how cuts line up with the music;
- how on-screen text is used, with example wording;
- its typical length in seconds;
- 1-3 sounds currently used with it (title and artist), with the BPM if you can find it.

Cite your sources.
`;

export const TrendsSchema = z.object({
  trends: z.array(
    z.object({
      id: z.string().min(1).describe("A short URL-safe slug for the format.").transform(toKebab),
      name: z.string(),
      whyNow: z.string().describe("Why it's popular right now, with the evidence the research gave."),
      structure: z.string().describe("Shot-by-shot structure, including how cuts line up with the music."),
      textStyle: z.string().describe("How on-screen text is used, with example wording."),
      typicalSeconds: z.number().min(3).max(90),
      sounds: z.array(
        z.object({
          title: z.string(),
          artist: z.string(),
          bpm: z.number().min(40).max(220).nullable().describe("Tempo in BPM, or null if the research didn't give one."),
          note: z.string().describe("Anything useful about using it, e.g. where the beat drops. Empty if nothing."),
        }),
      ),
      sourceUrls: z.array(z.string()).describe("URLs from the research that support this format."),
    }),
  ),
});

export const structureTrendsPrompt = (research: string, sources: Array<{ url: string; title?: string }>) => `
Turn this research on trending short-form video formats into JSON matching the schema. Keep only what the research supports; don't invent sounds, BPMs or sources. If the research gives no BPM for a sound, use null.

Research:
${research}

Sources found:
${sources.map((s) => `- ${s.title ? `${s.title}: ` : ""}${s.url}`).join("\n") || "(none)"}
`;

export const ReelPlanSchema = z.object({
  reels: z
    .array(
      z.object({
        id: z.string().min(1).describe("A short, unique, URL-safe slug, e.g. 'summit-photo-dump'.").transform(toKebab),
        title: z.string().describe("A short working title for the reel."),
        trendId: z.string().describe("The id of the trend this reel is built on."),
        sound: z.object({
          title: z.string().describe("The sound to add in Instagram, from the trend's sounds where possible."),
          artist: z.string(),
          bpm: z.number().min(40).max(220).nullable(),
        }),
        bpm: z
          .number()
          .min(60)
          .max(180)
          .describe(`The tempo the cuts are timed to: the sound's BPM if known, otherwise a fitting tempo (default ${DEFAULT_BPM}).`),
        soundNote: z.string().describe("How to line the sound up in Instagram, e.g. 'start at the chorus'."),
        caption: z.string().describe("Text to post with the reel, ending with up to 5 relevant hashtags."),
        shots: z
          .array(
            z.object({
              mediaId: z.string().describe("The id of the media item, e.g. 'm004'."),
              beats: z
                .number()
                .min(0.5)
                .max(16)
                .describe("How long the shot lasts, in beats of the tempo above. Use multiples of 0.5."),
              videoStart: z.number().min(0).nullable().describe(
                "Videos only: the second in the clip to start from. null for photos.",
              ),
              fit: z
                .enum(["cover", "blur"])
                .describe("cover crops to fill the tall frame; blur shows the whole image over a blurred copy of itself."),
              motion: z.enum(MOTIONS).describe("Slow camera move over the shot."),
              entrance: z.enum(ENTRANCES).describe("How the shot arrives: a plain cut, a zoom punch, or a white flash."),
              text: z.string().nullable().describe("On-screen text for this shot, under 8 words, or null for none."),
              textPosition: z.enum(TEXT_POSITIONS).describe("Where the text sits. Ignored when text is null."),
            }),
          )
          .min(3)
          .max(40),
      }),
    )
    .min(MIN_REELS)
    .max(MAX_REELS),
});

export const reelPlanPrompt = (
  analysis: MediaAnalysis,
  items: MediaItem[],
  trends: Trend[],
) => {
  const insights = new Map(analysis.items.map((i) => [i.id, i]));
  const mediaLines = items.map((item) => {
    const insight = insights.get(item.id);
    const shape = item.width >= item.height * 1.1 ? "landscape" : item.height >= item.width * 1.1 ? "portrait" : "square";
    const kind = item.kind === "video" ? `video ${item.duration?.toFixed(1)}s` : "photo";
    const best = insight?.bestStart != null ? `, best moment at ${insight.bestStart}s` : "";
    return `${item.id} [${kind}, ${shape}, ${insight?.score ?? "?"}/10, ${insight?.shotType ?? "other"}${best}] ${insight?.description ?? ""}`;
  });

  return `
You are a social media editor turning one photo album into ${MIN_REELS}-${MAX_REELS} Instagram Reels, each built on a different trending format.

Return only JSON matching the schema.

Album: ${analysis.summary} (subject: ${analysis.niche}; mood: ${analysis.mood})

How reels are built:
- A reel is a sequence of shots. Each shot shows one media item for a number of beats at the reel's tempo, so cuts land on the music. 1 beat at 120 BPM is 0.5s.
- Each reel lasts ${MIN_REEL_SECONDS}-${MAX_REEL_SECONDS} seconds in total (sum of beats x 60 / bpm). Match the trend's typical length.
- The sound itself is added later in Instagram, so pick it from the trend's sounds where possible and give its BPM as the reel's tempo. If no BPM is known, choose a tempo that fits the format, and set sound.bpm to null — never guess a sound's BPM.
- If the trend has no specific sound (none listed, or only "original audio"), set sound.title to "Any trending sound" and sound.artist to "", and use soundNote to describe the kind of track to pick: mood, tempo, where the beat should drop.
- fit: use cover for portrait media, and for landscape media whose subject survives a tall crop. Use blur for landscape shots where the full width matters (wide scenery, groups).
- motion: gentle moves (zoomIn, panLeft...) suit longer shots; use none for very short ones.
- entrance: punch or flash on big moments (the beat drop, a reveal); cut for everything else.
- text: short, punchy, lowercase is fine, under 8 words. To keep one line on screen across several shots, repeat the exact same text and position on each of them.

What makes these reels work:
- Follow each trend's structure and text style closely; that's what makes it recognisable.
- The first shot is the hook: the strongest image in the album, with the hook text if the format has one.
- Use the highest-scoring media and avoid near-duplicates within a reel. Each reel should feel different: different trend, different opening shot.
- Use each media item at most once per reel. Only use media ids from the list below; for videos, pick videoStart near the best moment.
- Prefer the trends researched as trending now; use the evergreen ones only if the album doesn't suit enough of them.

Trends:
${JSON.stringify(
  trends.map((t) => ({
    id: t.id,
    name: t.name,
    origin: t.origin,
    whyNow: t.whyNow,
    structure: t.structure,
    textStyle: t.textStyle,
    typicalSeconds: t.typicalSeconds,
    sounds: t.sounds,
  })),
)}

Media (id [kind, shape, score, type] description):
${mediaLines.join("\n")}
`;
};
