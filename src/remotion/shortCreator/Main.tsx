// src/remotion/shortCreator/Main.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { CalculateMetadataFunction } from "remotion";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption } from "@remotion/captions";

type Segment = { start: number; end: number };
type Props = { segments: Segment[], project: string };

export const ShortCreator: React.FC<Props> = ({ segments, project }) => {
  const { fps } = useVideoConfig();
  const src = staticFile(`projects/${project}/video.mp4`);
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender());

  const fetchCaptions = useCallback(async () => {
    try {
      const response = await fetch(staticFile(`projects/${project}/video-captions.json`));
      const data = await response.json();
      setCaptions(data);
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [continueRender, cancelRender, handle]);

  useEffect(() => {
    fetchCaptions();
  }, [fetchCaptions]);

  return (
    <TransitionSeries>
      {segments.map((seg, i) => {
        const trimBefore = Math.floor(seg.start * fps);
        const trimAfter = Math.floor(seg.end * fps);
        const durFrames = Math.max(1, trimAfter - trimBefore);

        const sequence = (
          <TransitionSeries.Sequence key={i} durationInFrames={durFrames}>
            <AbsoluteFill style={{ backgroundColor: "#020617" }}>
            <OffthreadVideo
              src={src}
              trimBefore={trimBefore}
              trimAfter={trimAfter}
              style={{  width: "100%",
                height: "85%",
                objectFit: "cover",
                margin: "auto", }}
            />
            <CaptionTrack
              captions={captions ?? []}
              segmentStartMs={seg.start * 1000}
              segmentEndMs={seg.end * 1000}
            />
            </AbsoluteFill>
          </TransitionSeries.Sequence>
        );
  
        if (i < segments.length - 1) {
          return [
            sequence,
            <TransitionSeries.Transition
              key={`trans-${i}`}
              presentation={fade()}
              timing={linearTiming({ durationInFrames: 5 })}
            />,
          ];
        }

        return [sequence];
      })}
      <TransitionSeries.Sequence durationInFrames={30}>
        <EndScreen />
      </TransitionSeries.Sequence>
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


const CaptionTrack: React.FC<{
  captions: Caption[];
  segmentStartMs: number;
  segmentEndMs: number;
}> = ({ captions, segmentStartMs, segmentEndMs }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const absoluteTimeMs = segmentStartMs + (frame / fps) * 1000;

  const pages = useMemo(() => {
    const segmentCaptions = captions.filter((caption) => {
      return caption.endMs > segmentStartMs && caption.startMs < segmentEndMs;
    });

    return createTikTokStyleCaptions({
      captions: segmentCaptions,
      combineTokensWithinMilliseconds: 800,
    }).pages;
  }, [captions, segmentStartMs, segmentEndMs]);

  const activePageIndex = pages.findIndex((page, index) => {
    const pageEndMs = page.tokens[page.tokens.length - 1]?.toMs ?? page.startMs;
    const nextStartMs = pages[index + 1]?.startMs ?? pageEndMs;

    return (
      absoluteTimeMs >= page.startMs &&
      absoluteTimeMs < Math.min(nextStartMs, segmentEndMs)
    );
  });

  if (activePageIndex === -1) {
    return null;
  }

  const page = pages[activePageIndex];
  const visibleTokens = page.tokens.filter((token) => {
    return token.fromMs < segmentEndMs && token.toMs > segmentStartMs;
  });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 10  }}>
      <div style={{ fontSize: 80, fontWeight: "bold", textAlign: "center", whiteSpace: "pre" }}>
        {visibleTokens.map((token) => {
          const isActive = token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs;
          return (
            <span key={token.fromMs} style={{ color: isActive ? "#FF37A1" : "#E1FF62", textShadow: "2px 2px 4px rgba(0,0,0,0.5)", WebkitTextStroke: "1px black" }}>
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};


const EndScreen: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#020617",
        color: "white",
        textAlign: "center",
        padding: 80,
      }}
    >
      <div style={{ maxWidth: 900, textAlign: "center" }}>
        <Img
          src={staticFile("profile.jpg")}
          style={{
            width: 300,
            height: 300,
            borderRadius: "50%",
            objectFit: "cover",
            marginBottom: 32,
            display: "block",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        />
        <div style={{ fontSize: 28, letterSpacing: 2, color: "#94a3b8", marginBottom: 20 }}>
          MORE HERE
        </div>

        <h1 style={{ fontSize: 72, fontWeight: 800, margin: 0, lineHeight: 1.05 }}>
          Gatsby Fitzgerald
        </h1>

        <p style={{ fontSize: 32, color: "#cbd5e1", marginTop: 24, marginBottom: 32 }}>
          More full length videos on my YouTube channel
        </p>

        <div
          style={{
            display: "inline-block",
            padding: "18px 28px",
            borderRadius: 999,
            border: "1px solid white",
            fontSize: 28,
            fontWeight: 700,
            color: "#E1FF62",
          }}
        >
          youtube.com/@GatsbyFitzgerald
        </div>
      </div>
    </AbsoluteFill>
  );
};