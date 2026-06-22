import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND_COLORS } from "../theme";

const BLOCK_COUNT = 3;
const BASE_FPS = 30;
const FIRST_FADE_OUT_SECONDS = 2;
const FADE_OUT_GAP_SECONDS = 3;
const FADE_OUT_DURATION_SECONDS = 0.6;
const END_BUFFER_SECONDS = 0.5;

const DURATION_IN_FRAMES = Math.ceil(
  (FIRST_FADE_OUT_SECONDS +
    (BLOCK_COUNT - 1) * FADE_OUT_GAP_SECONDS +
    FADE_OUT_DURATION_SECONDS +
    END_BUFFER_SECONDS) *
    BASE_FPS,
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

export const ThreeBlocksReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const blockWidth = 400;
  const blockHeight = 240;
  const gap = 64;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        gap,
        flexDirection: "row",
      }}
    >
      {Array.from({ length: BLOCK_COUNT }).map((_, index) => {
        const startFrame = 10 + index * 8;
        const fadeInOpacity = interpolate(
          frame,
          [startFrame, startFrame + fps / 2],
          [0, 0.92],
          {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          },
        );

        const fadeOutStartFrame =
          Math.round(FIRST_FADE_OUT_SECONDS * fps) +
          index * Math.round(FADE_OUT_GAP_SECONDS * fps);
        const fadeOutOpacity = interpolate(
          frame,
          [fadeOutStartFrame, fadeOutStartFrame + FADE_OUT_DURATION_SECONDS * fps],
          [1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );

        const opacity = fadeInOpacity * fadeOutOpacity;

        return (
          <div
            key={index}
            style={{
              width: blockWidth,
              height: blockHeight,
              borderRadius: 36,
              backgroundColor: BRAND_COLORS.yellow,
              boxShadow: "0 18px 40px rgba(0, 0, 0, 0.18)",
              opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
