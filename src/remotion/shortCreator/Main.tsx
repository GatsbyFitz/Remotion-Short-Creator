// src/remotion/shortCreator/Main.tsx
import React from "react";
import { useVideoConfig, staticFile, OffthreadVideo } from "remotion";
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import { fade } from "@remotion/transitions/fade";
import type { CalculateMetadataFunction } from "remotion";

type Segment = { start: number; end: number };

export const Stitcher: React.FC<{ segments: Segment[] }> = ({ segments }) => {
  const { fps } = useVideoConfig();
  const src = staticFile("video.mp4");

  return (
    <TransitionSeries>
      {segments.map((seg, i) => {
        const trimBefore = Math.floor(seg.start * fps);
        const trimAfter = Math.floor(seg.end * fps);
        const durFrames = Math.max(1, trimAfter - trimBefore);

        const seq = ( <TransitionSeries.Sequence key={i} durationInFrames={durFrames}>
            <OffthreadVideo
              src={src}
              trimBefore={trimBefore}
              trimAfter={trimAfter}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
            />
          </TransitionSeries.Sequence>)

          if (i < segments.length - 1) {
            return [
              seq,
              <TransitionSeries.Transition
                key={`trans-${i}`}
                presentation={fade()}
                timing={linearTiming({ durationInFrames: 15 })}
              />,
            ];
          }

          return [seq];
      })}
    </TransitionSeries>
  );
};

export const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const fps = 30;
  const normalized = (props.segments ?? [])
    .map((s) => ({ start: Number(s.start), end: Number(s.end) }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);

  const totalFrames = Math.max(
    1,
    normalized.reduce((acc, s) => acc + Math.max(1, Math.round((s.end - s.start) * fps)), 0)
  );

  return {
    props: { ...props, segments: normalized },
    fps,
    durationInFrames: totalFrames,
  };
};