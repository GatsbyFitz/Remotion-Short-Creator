// src/remotion/shortCreator/Main.tsx
import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig, staticFile, OffthreadVideo } from "remotion";
import type { CalculateMetadataFunction } from "remotion";

type Segment = { start: number; end: number };

export const Stitcher: React.FC<{ segments: Segment[] }> = ({ segments }) => {
  const { fps } = useVideoConfig();
  const src = staticFile("video.mp4");

  let cursor = 0;
  return (
    <AbsoluteFill>
      {segments.map((seg, i) => {
        const trimBefore = seg.start; // seconds
        const trimAfter = seg.end; // seconds
        const durFrames = Math.max(1, Math.round((trimAfter - trimBefore) * fps));
        const from = cursor;
        cursor += durFrames;
        
        return (
          <Sequence key={i} from={from} durationInFrames={durFrames} layout="none">
            <AbsoluteFill>
              <OffthreadVideo
                src={src}
                trimBefore={60}
                trimAfter={120}
                style={{ objectFit: "cover", width: "100%", height: "100%" }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
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