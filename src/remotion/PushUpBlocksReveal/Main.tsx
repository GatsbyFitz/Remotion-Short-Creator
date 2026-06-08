import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

const BLOCK_COUNT = 3;
const LABELS = ["Normal", "Wide", "Narrow"] as const;
const BASE_FPS = 30;
const FIRST_FADE_START_FRAME = 54;
const FADE_GAP_SECONDS = 3;
const FADE_DURATION_SECONDS = 0.5;
const END_BUFFER_SECONDS = 0.5;

const DURATION_IN_FRAMES = Math.ceil(
  FIRST_FADE_START_FRAME +
    (BLOCK_COUNT - 1) * FADE_GAP_SECONDS * BASE_FPS +
    FADE_DURATION_SECONDS * BASE_FPS +
    END_BUFFER_SECONDS * BASE_FPS,
);

export const calculateMetadata = async () => {
  return {
    fps: BASE_FPS,
    durationInFrames: DURATION_IN_FRAMES,
    width: 1920,
    height: 1080,
    defaultCodec: "prores" as const,
    defaultVideoImageFormat: "png" as const,
    defaultPixelFormat: "yuva444p10le" as const,
    defaultProResProfile: "4444" as const,
  } as const;
};

export const PushUpBlocksReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const blockWidth = 400;
  const blockHeight = 240;
  const gap = 64;

  const moveProgress = spring({
    fps,
    frame,
    config: { damping: 200, stiffness: 120, mass: 0.8 },
  });
  const blocksOffset = interpolate(moveProgress, [0, 1], [0, -260], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          gap,
          justifyContent: "center",
          alignItems: "flex-start",
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          transform: `translateY(calc(-50% + ${blocksOffset}px))`,
          zIndex: 2,
        }}
      >
        {Array.from({ length: BLOCK_COUNT }).map((_, index) => {
          const fadeStart =
            FIRST_FADE_START_FRAME + index * Math.round(FADE_GAP_SECONDS * fps);
          const fadeProgress = interpolate(
            frame,
            [fadeStart, fadeStart + fps / 2],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          );
                const blockOpacity = interpolate(fadeProgress, [0, 1], [1, 0], {
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={`block-${index}`}
              style={{
                width: blockWidth,
                height: blockHeight,
                borderRadius: 36,
                backgroundColor: BRAND_COLORS.yellow,
                boxShadow: "0 18px 40px rgba(0, 0, 0, 0.18)",
                opacity: blockOpacity,
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap,
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          transform: `translateY(calc(-50% + ${blocksOffset}px))`,
          zIndex: 1,
        }}
      >
        {LABELS.map((label, index) => {
          const revealStart =
            FIRST_FADE_START_FRAME + index * Math.round(FADE_GAP_SECONDS * fps);
          const revealOpacity = interpolate(
            frame,
            [revealStart, revealStart + fps / 2],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          );

          return (
            <div
              key={label}
              style={{
                width: blockWidth,
                textAlign: "center",
                fontFamily: BRAND_FONTS.secondary,
                fontSize: 110,
                fontWeight: 700,
                letterSpacing: 2,
                color: BRAND_COLORS.yellow,
                textShadow: "0 12px 28px rgba(0, 0, 0, 0.2)",
                opacity: revealOpacity,
              }}
            >
              {label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
