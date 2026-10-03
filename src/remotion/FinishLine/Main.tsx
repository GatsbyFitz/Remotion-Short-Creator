import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

const BASE_FPS = 30;
const DURATION_IN_FRAMES = 150;

const DROP_END = 30;
const CHECKS_START = 10;
const TEXT_START = 28;
const SPLIT_START = 90;
const SPLIT_END = 140;

// Runs the full width and bleeds off both edges; the frame is the only thing
// bounding it.
const BANNER_LEFT = 0;
const BANNER_RIGHT = 1920;
const BANNER_HEIGHT = 164;
const BANNER_TOP = 540 - BANNER_HEIGHT / 2;
const BANNER_BOTTOM = BANNER_TOP + BANNER_HEIGHT;

const CHECK_SIZE = 44;
const CHECK_STRIP = 22;
const CHECK_COUNT = Math.ceil((BANNER_RIGHT - BANNER_LEFT) / CHECK_SIZE);

const SPLIT_AT = 960;
// Far enough that both halves clear the frame entirely, leaving the shot clean.
const SPLIT_TRAVEL = 1010;

const CHECK_ROWS = [
  { y: BANNER_TOP, parity: 0 },
  { y: BANNER_TOP + CHECK_STRIP, parity: 1 },
  { y: BANNER_BOTTOM - CHECK_STRIP * 2, parity: 1 },
  { y: BANNER_BOTTOM - CHECK_STRIP, parity: 0 },
] as const;

const TEXT_SHADOW = "0 4px 20px rgba(0, 0, 0, 0.65)";

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

export const FinishLine: React.FC = () => {
  const frame = useCurrentFrame();

  const drop = interpolate(frame, [0, DROP_END], [-(BANNER_HEIGHT + 60), 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 1.25, 0.4, 1),
  });
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const checks = interpolate(frame, [CHECKS_START, CHECKS_START + 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const textIn = interpolate(frame, [TEXT_START, TEXT_START + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const split = interpolate(frame, [SPLIT_START, SPLIT_END], [0, SPLIT_TRAVEL], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.3, 0, 0.15, 1),
  });

  const banner = (
    <>
      {CHECK_ROWS.map((row) =>
        Array.from({ length: CHECK_COUNT }, (_, i) => {
          if ((i + row.parity) % 2 !== 0) return null;
          const x = BANNER_LEFT + i * CHECK_SIZE;
          return (
            <rect
              key={`${row.y}-${i}`}
              x={x}
              y={row.y}
              width={Math.min(CHECK_SIZE, BANNER_RIGHT - x)}
              height={CHECK_STRIP}
              fill={BRAND_COLORS.yellow}
              opacity={checks > i / CHECK_COUNT ? 1 : 0}
            />
          );
        }),
      )}

      <text
        x={960}
        y={540 + 4}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontFamily: BRAND_FONTS.primary,
          fontSize: 64,
          fontWeight: 600,
          letterSpacing: 14,
          fill: BRAND_COLORS.light,
          opacity: textIn,
          textShadow: TEXT_SHADOW,
        }}
      >
        FINISH
      </text>
    </>
  );

  return (
    <AbsoluteFill>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        role="img"
        aria-label="A chequered finish banner that splits apart down the middle"
        style={{ filter: "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5))" }}
      >
        <defs>
          <clipPath id="finishHalfLeft">
            <rect x={0} y={0} width={SPLIT_AT} height={1080} />
          </clipPath>
          <clipPath id="finishHalfRight">
            <rect x={SPLIT_AT} y={0} width={1920 - SPLIT_AT} height={1080} />
          </clipPath>
        </defs>

        {/* Clip sits inside the transform, so each half is cut in place and then
            carried away whole — the other order would slide the content out of a
            stationary window instead. */}
        <g transform={`translate(${-split} ${drop})`} opacity={opacity}>
          <g clipPath="url(#finishHalfLeft)">{banner}</g>
        </g>
        <g transform={`translate(${split} ${drop})`} opacity={opacity}>
          <g clipPath="url(#finishHalfRight)">{banner}</g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
