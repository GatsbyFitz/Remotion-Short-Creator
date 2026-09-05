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
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

type SegmentEffect = "grayscale" | "invert" | "scale";

type Segment = {
  start: number;
  end: number;
  effect?: SegmentEffect;
  transition?: string;
  // Horizontal focal point of the crop, 0..1 (0 = keep left edge, 0.5 =
  // centred, 1 = keep right edge). Absent -> centred, identical to the default.
  focusX?: number;
  // How much of the frame's width to crop away, 0..1. 1 (the default when
  // absent) crops edge-to-edge to fill the band; 0 shows the whole frame width
  // letterboxed. Unrelated to SegmentEffect's "scale" case below.
  scale?: number;
};

// videoTitle is the overall video's title (editable per-project), shown in the
// header of every short cut from it — distinct from each short's own title.
// sourceAspectRatio is per-project (one source video per project), captured at
// upload time; it's what lets `scale` interpolate between contain and cover.
type Props = {
  segments: Segment[];
  project: string;
  videoTitle?: string;
  sourceAspectRatio?: number;
};

// The footage fills the middle band of the frame; the header and captions live in
// the equal empty bands above and below it (composition is 1080x1920).
const FOOTAGE_HEIGHT_RATIO = 0.8;
const EDGE_BAND_RATIO = (1 - FOOTAGE_HEIGHT_RATIO) / 2;

// Assumed for projects uploaded before source dimensions were captured. Action-cam
// footage is overwhelmingly 16:9, so this keeps old projects rendering as before.
const DEFAULT_SOURCE_ASPECT_RATIO = 16 / 9;

// Vertical fade applied to the footage so it dissolves into the background at the
// top and bottom edges instead of ending on a hard line.
const FOOTAGE_EDGE_FADE = "9%";
const FOOTAGE_EDGE_FADE_MASK = `linear-gradient(to bottom, transparent 0%, #000 ${FOOTAGE_EDGE_FADE}, #000 calc(100% - ${FOOTAGE_EDGE_FADE}), transparent 100%)`;

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

export const ShortCreator: React.FC<Props> = ({
  segments,
  project,
  videoTitle,
  sourceAspectRatio,
}) => {
  const { fps, width, height } = useVideoConfig();
  const endScreenDurationInFrames = Math.round(5 * fps);

  // The footage box the video is fitted into and clipped by.
  const boxWidthPx = width;
  const boxHeightPx = height * FOOTAGE_HEIGHT_RATIO;

  // The video is always laid out with objectFit "contain" (the whole frame,
  // letterboxed) and then scaled up towards "cover" (edge-to-edge crop). Scaling
  // the contain-fitted box by exactly this factor lands on cover on both axes.
  const coverScale =
    (sourceAspectRatio ?? DEFAULT_SOURCE_ASPECT_RATIO) / (boxWidthPx / boxHeightPx);
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

        // scale 1 (default) = full edge-to-edge crop, 0 = whole frame letterboxed.
        const appliedScale = 1 + (seg.scale ?? 1) * (coverScale - 1);
        // Only the width that overflows the box can be panned across, so at
        // scale 0 there is nothing to pan and focusX is inert.
        const maxOffsetPx = (boxWidthPx * (appliedScale - 1)) / 2;
        const translateXPx = -((seg.focusX ?? 0.5) - 0.5) * 2 * maxOffsetPx;

        const sequence = (
          <TransitionSeries.Sequence key={i} durationInFrames={durFrames}>
            <AbsoluteFill style={{ backgroundColor: "#020617" }}>
              <div
                style={{
                  width: "100%",
                  height: `${FOOTAGE_HEIGHT_RATIO * 100}%`,
                  margin: "auto",
                  overflow: "hidden",
                  // Dissolve the footage into the background at the top and bottom
                  // edges rather than a hard cut.
                  maskImage: FOOTAGE_EDGE_FADE_MASK,
                  WebkitMaskImage: FOOTAGE_EDGE_FADE_MASK,
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
                    // Laid out as "contain" (whole frame, letterboxed) and scaled
                    // up towards "cover" (edge-to-edge crop) by `scale`, then
                    // panned by `focusX`. translateX is listed first so it stays a
                    // plain on-screen pixel offset rather than being multiplied by
                    // the scale that follows it.
                    transform: `translateX(${translateXPx}px) scale(${appliedScale})`,
                  }}
                  objectFit="contain"
                />
              </div>
              <CaptionTrack
                captions={captions ?? []}
                segmentStartMs={seg.start * 1000}
                segmentEndMs={seg.end * 1000}
              />
              <ShortHeader title={videoTitle} />
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
      focusX:
        s.focusX == null || !Number.isFinite(Number(s.focusX))
          ? undefined
          : Math.min(1, Math.max(0, Number(s.focusX))),
      scale:
        s.scale == null || !Number.isFinite(Number(s.scale))
          ? undefined
          : Math.min(1, Math.max(0, Number(s.scale))),
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

const YouTubeGlyph: React.FC<{ height?: number }> = ({ height = 30 }) => (
  <svg
    viewBox="0 0 28 20"
    height={height}
    width={(height * 28) / 20}
    role="img"
    aria-label="YouTube"
  >
    <path
      d="M27.4 3.12A3.52 3.52 0 0 0 24.92.64C22.74.05 14 .05 14 .05S5.26.05 3.08.64A3.52 3.52 0 0 0 .6 3.12 36.9 36.9 0 0 0 0 10a36.9 36.9 0 0 0 .6 6.88 3.52 3.52 0 0 0 2.48 2.48C5.26 19.95 14 19.95 14 19.95s8.74 0 10.92-.59a3.52 3.52 0 0 0 2.48-2.48A36.9 36.9 0 0 0 28 10a36.9 36.9 0 0 0-.6-6.88Z"
      fill="#FF0000"
    />
    <path d="M11.2 14.29 18.53 10 11.2 5.71Z" fill="#ffffff" />
  </svg>
);

// Sits in the empty band above the centred footage. Clipped to that band's height
// so a long title can't spill onto the video.
const ShortHeader: React.FC<{ title?: string }> = ({ title }) => {
  const { height } = useVideoConfig();
  const bandHeight = height * EDGE_BAND_RATIO;

  return (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: bandHeight,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: "0 56px",
      overflow: "hidden",
      textAlign: "center",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <YouTubeGlyph height={30} />
      <span
        style={{
          fontFamily: BRAND_FONTS.primary,
          fontSize: 30,
          fontWeight: 700,
          color: "#ffffff",
          letterSpacing: 0.5,
        }}
      >
        Gatsby Fitzgerald
      </span>
    </div>
    {title ? (
      <span
        style={{
          fontFamily: BRAND_FONTS.primary,
          fontSize: 38,
          fontWeight: 800,
          lineHeight: 1.1,
          color: BRAND_COLORS.yellow,
          textShadow: "0 2px 6px rgba(0,0,0,0.45)",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
        }}
      >
        {title}
      </span>
    ) : null}
  </div>
  );
};

const CaptionTrack: React.FC<{
  captions: Caption[];
  segmentStartMs: number;
  segmentEndMs: number;
}> = ({ captions, segmentStartMs, segmentEndMs }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const bandHeight = height * EDGE_BAND_RATIO;
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
    <div
      style={{
        // Span exactly the empty band below the centred footage and centre the
        // caption within it, mirroring <ShortHeader> at the top.
        position: "absolute",
        left: 0,
        right: 0,
        top: height - bandHeight,
        height: bandHeight,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontSize: 70,
          fontWeight: "bold",
          textAlign: "center",
          whiteSpace: "pre",
          lineHeight: 1,
        }}
      >
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
    </div>
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