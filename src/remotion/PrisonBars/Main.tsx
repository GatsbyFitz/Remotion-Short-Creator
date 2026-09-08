import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND_COLORS } from "../theme";

const BASE_FPS = 30;
const DURATION_IN_FRAMES = 150; // 5s @ 30fps

const BAR_COUNT = 9;
const BAR_WIDTH = 52;

// Bars drop in left to right.
const BARS_START_FRAME = 14;
const BAR_STAGGER = 7;
const FALL_FRAMES = 11;
const SETTLE_FRAMES = 11;

// Bars run past the top and bottom edges so the rebound after impact never
// exposes a gap at the frame edge.
const BAR_OVERHANG = 90;

// The rails frame the cell before the bars land in it.
const RAIL_HEIGHT = 44;
const RAIL_INSET_Y = 96;

// Neon green bars. The bright centre band is the brand accent; the darker
// shades either side are the same hue dropped in luminance, which is what gives
// each bar its rounded, metallic read instead of looking like a flat stripe.
const BAR_METAL = `linear-gradient(90deg, #5c7518 0%, #8fb02c 10%, ${BRAND_COLORS.yellow} 36%, ${BRAND_COLORS.yellow} 52%, #9dbd35 74%, #5c7518 100%)`;
const RAIL_METAL = `linear-gradient(180deg, #5c7518 0%, #8fb02c 14%, ${BRAND_COLORS.yellow} 42%, ${BRAND_COLORS.yellow} 56%, #9dbd35 78%, #5c7518 100%)`;

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

export const PrisonBars: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const slotWidth = width / BAR_COUNT;
  const barHeight = height + BAR_OVERHANG * 2;

  // Rails wipe in from the left to frame the cell before the bars land.
  const railProgress = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill>
      {Array.from({ length: BAR_COUNT }).map((_, index) => {
        const start = BARS_START_FRAME + index * BAR_STAGGER;
        const impactFrame = start + FALL_FRAMES;

        // Accelerating fall, so each bar reads as dropping under its own weight
        // rather than easing politely into place.
        const fall = interpolate(frame, [start, impactFrame], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.in(Easing.quad),
        });

        // Small rebound up off the impact, then back down to rest.
        const rebound = interpolate(
          frame,
          [impactFrame, impactFrame + SETTLE_FRAMES / 2, impactFrame + SETTLE_FRAMES],
          [0, -16, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        // Shadow briefly deepens on landing to give the bar some weight.
        const impact = interpolate(
          frame,
          [impactFrame, impactFrame + 2, impactFrame + SETTLE_FRAMES],
          [0, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        const translateY = interpolate(fall, [0, 1], [-barHeight, 0]) + rebound;

        return (
          <div
            key={index}
            style={{
              position: "absolute",
              top: -BAR_OVERHANG,
              left: index * slotWidth + slotWidth / 2 - BAR_WIDTH / 2,
              width: BAR_WIDTH,
              height: barHeight,
              background: BAR_METAL,
              boxShadow: `0 0 ${26 + impact * 20}px rgba(0, 0, 0, ${0.34 + impact * 0.16})`,
              transform: `translateY(${translateY}px)`,
            }}
          />
        );
      })}

      {[RAIL_INSET_Y, height - RAIL_INSET_Y - RAIL_HEIGHT].map((top) => (
        <div
          key={top}
          style={{
            position: "absolute",
            top,
            left: 0,
            width,
            height: RAIL_HEIGHT,
            background: RAIL_METAL,
            boxShadow: "0 0 26px rgba(0, 0, 0, 0.34)",
            transform: `scaleX(${railProgress})`,
            transformOrigin: "left center",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
