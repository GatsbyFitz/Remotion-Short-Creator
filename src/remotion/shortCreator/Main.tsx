import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
  interpolate, // add this
} from "remotion";
import { Video } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { iris } from "@remotion/transitions/iris";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import type { CalculateMetadataFunction } from "remotion";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption } from "@remotion/captions";
import { grayscale } from "@remotion/effects/grayscale";
import { invert } from "@remotion/effects/invert";
import { scale } from "@remotion/effects/scale";
import { BRAND_FONTS } from "../theme";

type SegmentEffect = "grayscale" | "invert" | "scale";

type Segment = {
  start: number;
  end: number;
  effect?: SegmentEffect;
  transition?: string;
};

type Props = { segments: Segment[]; project: string };

// Slight rounding on the edges of the enlarged footage (composition is 1080x1920).
const FOOTAGE_BORDER_RADIUS = 48;

const getEffects = (effect?: SegmentEffect) => {
  switch (effect) {
    case "grayscale":
      return [grayscale({})];
    case "invert":
      return [invert({})];
    case "scale":
      return[scale({scale: 1.3})];
    default:
      return [];
  }
};

const getTransition = (transition?: string) => {
  switch (transition) {
    case "fade":
      return fade();
    case "slide":
      return slide();
    case "wipe":
      return wipe();
    case "flip":
      return flip();
    case "iris":
      return iris();
    case "clockWipe":
      return clockWipe();
    default:
      return fade();
  }
};

const getSegmentVolume = (frame: number, durationInFrames: number, fadeFrames = 8) => {
  const safeFade = Math.max(1, Math.min(fadeFrames, Math.floor(durationInFrames / 2)));

  const fadeIn = interpolate(frame, [0, safeFade], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(frame, [durationInFrames - safeFade, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return Math.min(fadeIn, fadeOut);
};

export const ShortCreator: React.FC<Props> = ({ segments, project }) => {
  const { fps } = useVideoConfig();
  const endScreenDurationInFrames = Math.round(5 * fps);
  const src = staticFile(`projects/${project}/video.mp4`);
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender());

  const fetchCaptions = useCallback(async () => {
    try {
      const response = await fetch(
        staticFile(`projects/${project}/video-captions.json`)
      );
      const data = await response.json();
      setCaptions(data);
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [continueRender, cancelRender, handle, project]);

  useEffect(() => {
    fetchCaptions();
  }, [fetchCaptions]);

  return (
    <TransitionSeries> 
      {segments.map((seg, i) => {
        const trimBefore = Math.floor(seg.start * fps);
        const trimAfter = Math.floor(seg.end * fps);
        const durFrames = Math.max(1, trimAfter - trimBefore);
        const effects = getEffects(seg.effect);
        const transition = getTransition(seg.transition);

        const sequence = (
          <TransitionSeries.Sequence key={i} durationInFrames={durFrames}>
            <AbsoluteFill style={{ backgroundColor: "#020617" }}>
              <div
                style={{
                  width: "100%",
                  height: "85%",
                  margin: "auto",
                  borderRadius: FOOTAGE_BORDER_RADIUS,
                  overflow: "hidden",
                  // Keeps the rounded corners from being clipped away by the
                  // browser's rasterization of the video layer.
                  WebkitMaskImage: "-webkit-radial-gradient(white, black)",
                  transform: "translateZ(0)",
                }}
              >
                <Video
                  src={src}
                  _experimentalEffects={effects}
                  trimBefore={trimBefore}
                  trimAfter={trimAfter}
                  volume={(f) => getSegmentVolume(f, durFrames, 8)}
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: FOOTAGE_BORDER_RADIUS,
                  }}
                  objectFit="cover"
                />
              </div>
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
              presentation={transition}
              timing={linearTiming({ durationInFrames: 5 })}
            />,
          ];
        }

        return [sequence];
      })}
      <TransitionSeries.Sequence durationInFrames={endScreenDurationInFrames}>
        <EndScreen project={project} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

export const calculateMetadata: CalculateMetadataFunction<Props> = async ({
  props,
}) => {
  const fps = 30;
  const normalized = (props.segments ?? [])
    .map((s) => ({
      start: Number(s.start),
      end: Number(s.end),
      effect: s.effect,
      transition: s.transition,
    }))
    .filter(
      (s) =>
        Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start
    );

  const totalFrames = Math.max(
    1,
    normalized.reduce(
      (acc, s) => acc + Math.max(1, Math.round((s.end - s.start) * fps)),
      0
    )
  );

  const endScreenDurationInFrames = Math.round(5 * fps);

  return {
    props: { ...props, segments: normalized },
    fps,
    durationInFrames: totalFrames + endScreenDurationInFrames,
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
      combineTokensWithinMilliseconds: 500,
    }).pages;
  }, [captions, segmentStartMs, segmentEndMs]);

  const activePage = pages.find((page) => {
    const pageEndMs = page.startMs + page.durationMs;

    return absoluteTimeMs >= page.startMs && absoluteTimeMs < pageEndMs;
  });

  if (!activePage) {
    return null;
  }

  const activeToken = activePage.tokens.find((token) => {
    return absoluteTimeMs >= token.fromMs && absoluteTimeMs < token.toMs;
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 10,
      }}
    >
      <div style={{ fontSize: 80, fontWeight: "bold", textAlign: "center", whiteSpace: "pre" }}>
        {activePage.tokens.map((token) => {
          const isActive = activeToken
            ? token.fromMs === activeToken.fromMs && token.toMs === activeToken.toMs
            : false;

          return (
            <span
              key={`${token.fromMs}-${token.toMs}`}
              style={{
                color: isActive ? "#FF37A1" : "#E1FF62",
                textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
                WebkitTextStroke: "1px black",
                fontFamily: BRAND_FONTS.secondary,
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};


const EndScreen: React.FC<{ project: string }> = ({ project }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const thumbnailPhaseFrames = Math.round(3 * fps); // first 3s
  const showThumbnailPhase = frame < thumbnailPhaseFrames; // last 2s = profile

  const candidates = [
    staticFile(`projects/${project}/thumbnail.jpg`),
    staticFile(`projects/${project}/thumbnail.jpeg`),
    staticFile(`projects/${project}/thumbnail.png`),
    staticFile(`projects/${project}/thumbnail.webp`),
  ];
  const [thumbIndex, setThumbIndex] = useState(0);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#020617",
        color: "white",
        textAlign: "center",
        padding: 80,
        fontFamily: BRAND_FONTS.primary,
      }}
    >
      {showThumbnailPhase ? (
        <Img
          src={candidates[thumbIndex]}
          onError={() => {
            if (thumbIndex < candidates.length - 1) {
              setThumbIndex((i) => i + 1);
            }
          }}
          style={{
            width: "100%",
            borderRadius: 16,
            objectFit: "cover",
            aspectRatio: "16 / 9",
            boxShadow: "0 8px 18px #E1FF62",
          }}
        />
      ) : (
        <div style={{ maxWidth: 900, textAlign: "center" }}>
          <Img
            src={staticFile("miscellaneous/profile.jpg")}
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
              fontSize: 28,
              fontWeight: 700,
              color: "#E1FF62",
            }}
          >
            youtube.com/@GatsbyFitzgerald
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};