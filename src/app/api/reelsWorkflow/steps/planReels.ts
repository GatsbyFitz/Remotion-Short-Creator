import { z } from "zod";
import { generateStructuredWithRepair } from "../../shortsWorkflow/steps/instructionsShared";
import { uniqueIds } from "../../clipsWorkflow/steps/clipsShared";
import {
  MAX_REEL_SECONDS,
  MIN_REEL_SECONDS,
  MediaAnalysis,
  MediaInsight,
  MediaItem,
  MediaManifest,
  Reel,
  ReelPlanSchema,
  ReelShot,
  TrendResearch,
  readJson,
  reelPath,
  reelPlanPrompt,
  setStatus,
  writeJson,
} from "./reelsShared";

type PlannedReel = z.infer<typeof ReelPlanSchema>["reels"][number];

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const ANY_SOUND = "Any trending sound";

// "Original audio" means creators use their own audio, which isn't something
// to search for in Instagram's sound picker.
const isGenericSound = (title: string) => /^(original audio|any trending sound|various|n\/a|none)$/i.test(title.trim());

// The sound shown to the user only carries a BPM the research actually found.
// The plan's own `bpm` (the tempo the cuts are timed to) is kept separately and
// can be the model's choice.
const resolveSound = (planned: PlannedReel["sound"], research: TrendResearch) => {
  if (isGenericSound(planned.title)) {
    return { title: ANY_SOUND, artist: "", bpm: null };
  }

  const known = research.trends
    .flatMap((t) => t.sounds)
    .find((s) => s.title.trim().toLowerCase() === planned.title.trim().toLowerCase());

  return { title: planned.title, artist: planned.artist, bpm: known?.bpm ?? null };
};

// Checks a planned reel against the real media: drops shots on unknown ids,
// snaps durations to half beats, stops before the 30s cap, keeps each video's
// start inside the clip, and loops a clip only when it's shorter than its shot.
const finalizeReel = (
  reel: PlannedReel,
  media: Map<string, MediaItem>,
  insights: Map<string, MediaInsight>,
  research: TrendResearch,
): Reel => {
  const bpm = clamp(reel.bpm, 60, 180);
  const secondsPerBeat = 60 / bpm;
  const shots: ReelShot[] = [];
  let totalBeats = 0;

  for (const shot of reel.shots) {
    const item = media.get(shot.mediaId);
    if (!item) {
      continue;
    }

    const beats = Math.max(0.5, Math.round(shot.beats * 2) / 2);
    if ((totalBeats + beats) * secondsPerBeat > MAX_REEL_SECONDS) {
      break;
    }

    const seconds = beats * secondsPerBeat;
    const insight = insights.get(item.id);
    const duration = item.duration ?? 0;
    const wantedStart = shot.videoStart ?? insight?.bestStart ?? 0;

    shots.push({
      mediaId: item.id,
      file: item.file,
      kind: item.kind,
      width: item.width,
      height: item.height,
      beats,
      videoStart: item.kind === "video" ? round(clamp(wantedStart, 0, Math.max(0, duration - seconds)), 2) : 0,
      loop: item.kind === "video" && duration < seconds,
      fit: shot.fit,
      focusX: insight?.focusX ?? 0.5,
      motion: shot.motion,
      entrance: shot.entrance,
      text: shot.text?.trim() || null,
      textPosition: shot.textPosition,
    });
    totalBeats += beats;
  }

  return {
    id: reel.id,
    title: reel.title,
    trendId: reel.trendId,
    trendName: research.trends.find((t) => t.id === reel.trendId)?.name ?? reel.trendId,
    sound: resolveSound(reel.sound, research),
    soundNote: reel.soundNote,
    caption: reel.caption,
    bpm,
    durationSeconds: round(totalBeats * secondsPerBeat, 2),
    shots,
  };
};

// Lays out 3-5 reels, each on a different trend, from the album's analysed
// media, and writes reels.json for the UI and Remotion Studio.
export async function planReels(project: string, research: TrendResearch) {
  "use step";

  setStatus(project, "planning");

  const analysis = readJson<MediaAnalysis>(reelPath(project, "media-analysis.json"));
  const manifest = readJson<MediaManifest>(reelPath(project, "media-manifest.json"));

  // Only analysed media is offered: the plan has nothing to go on for the rest.
  const insights = new Map(analysis.items.map((i) => [i.id, i]));
  const items = manifest.items.filter((i) => insights.has(i.id));
  const media = new Map(items.map((i) => [i.id, i]));

  const plan = await generateStructuredWithRepair({
    model: "google/gemini-3.7-flash",
    messages: [{ role: "user", content: [{ type: "text", text: reelPlanPrompt(analysis, items, research.trends) }] }],
    schema: ReelPlanSchema,
  });

  const reels = uniqueIds(
    plan.reels.map((reel, index) => finalizeReel({ ...reel, id: reel.id || `reel-${index + 1}` }, media, insights, research)),
  ).filter((reel) => reel.shots.length >= 3);

  for (const reel of reels) {
    if (reel.durationSeconds < MIN_REEL_SECONDS) {
      console.warn(`Reel "${reel.id}" is only ${reel.durationSeconds}s.`);
    }
  }

  if (reels.length === 0) {
    throw new Error(`The plan for "${project}" produced no usable reels.`);
  }

  writeJson(reelPath(project, "reels.json"), {
    generatedAt: new Date().toISOString(),
    trendsOrigin: research.origin,
    reels,
  });
  setStatus(project, "ready");

  console.log(
    `Reels plan: ${reels.length} reels — ${reels.map((r) => `${r.id} (${r.trendName}, ${r.durationSeconds}s, ${r.shots.length} shots)`).join("; ")}.`,
  );

  return { reelCount: reels.length };
}
