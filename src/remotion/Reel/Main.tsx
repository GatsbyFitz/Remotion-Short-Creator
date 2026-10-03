import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { BRAND_COLORS } from "../theme";
import { ReelText } from "./ReelText";
import { Shot, type ReelShot } from "./Shot";

// A vertical reel planned by the reels workflow: a sequence of photos and clips
// cut on the beat of the sound it was built for. The sound itself is added in
// Instagram, so the render is silent.
type Props = {
  project: string;
  bpm: number;
  shots: ReelShot[];
  outName?: string;
};

const FPS = 30;

// Each shot's frames, from cumulative beats, so rounding never drifts the cuts
// off the beat over a long reel.
const shotTimings = (shots: ReelShot[], bpm: number, fps: number) => {
  const framesPerBeat = (fps * 60) / bpm;
  let beats = 0;

  return shots.map((shot) => {
    const from = Math.round(beats * framesPerBeat);
    beats += shot.beats;
    return { from, durationInFrames: Math.max(1, Math.round(beats * framesPerBeat) - from) };
  });
};

// Consecutive shots with the same text and position share one overlay, so a
// line held across several cuts pops in once rather than on every cut.
const textRuns = (shots: ReelShot[], timings: Array<{ from: number; durationInFrames: number }>) => {
  const runs: Array<{ text: string; position: ReelShot["textPosition"]; from: number; durationInFrames: number }> = [];

  shots.forEach((shot, index) => {
    if (!shot.text) return;

    const timing = timings[index];
    const last = runs[runs.length - 1];

    if (last && last.text === shot.text && last.position === shot.textPosition && last.from + last.durationInFrames === timing.from) {
      last.durationInFrames += timing.durationInFrames;
    } else {
      runs.push({ text: shot.text, position: shot.textPosition, ...timing });
    }
  });

  return runs;
};

export const Reel: React.FC<Props> = ({ project, bpm, shots }) => {
  const { fps } = useVideoConfig();
  const timings = useMemo(() => shotTimings(shots, bpm, fps), [shots, bpm, fps]);
  const runs = useMemo(() => textRuns(shots, timings), [shots, timings]);

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND_COLORS.black }}>
      {shots.map((shot, index) => (
        // Premounted so a clip is already decoding when its cut arrives.
        <Sequence
          key={`${shot.mediaId}-${index}`}
          from={timings[index].from}
          durationInFrames={timings[index].durationInFrames}
          premountFor={fps}
        >
          <Shot project={project} shot={shot} />
        </Sequence>
      ))}
      {runs.map((run, index) => (
        <Sequence key={`text-${index}`} from={run.from} durationInFrames={run.durationInFrames}>
          <ReelText text={run.text} position={run.position} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const totalBeats = props.shots.reduce((sum, shot) => sum + shot.beats, 0);

  return {
    fps: FPS,
    width: 1080,
    height: 1920,
    durationInFrames: Math.max(1, Math.round((totalBeats * FPS * 60) / props.bpm)),
    defaultCodec: "h264" as const,
    ...(props.outName ? { defaultOutName: props.outName } : {}),
  };
};
