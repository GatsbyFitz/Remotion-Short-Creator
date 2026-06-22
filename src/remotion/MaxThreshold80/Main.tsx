import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

const BASE_FPS = 30;
const DURATION_IN_FRAMES = 150;
const THRESHOLD_PERCENT = 80;
const REVEAL_DURATION_SECONDS = 2;

const START_ANGLE_DEG = -210;
const SWEEP_DEG = 240;

export const MaxThreshold80: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reveal = interpolate(
    frame,
    [0, REVEAL_DURATION_SECONDS * fps],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );

  const progress = interpolate(reveal, [0, 1], [0, THRESHOLD_PERCENT / 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const countValue = Math.round(
    interpolate(reveal, [0, 1], [0, THRESHOLD_PERCENT], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const radius = 300;
  const cx = 960;
  const cy = 560;
  const circumference = 2 * Math.PI * radius;
  const maxArcLength = circumference * (SWEEP_DEG / 360);
  const progressArcLength = maxArcLength * progress;
  const thresholdAngle = START_ANGLE_DEG + SWEEP_DEG * (THRESHOLD_PERCENT / 100);

  const markerPulse = interpolate(frame, [90, 120, 150], [0.95, 1.07, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" role="img" aria-label="80 percent max threshold graphic">
        <g transform={`translate(${cx} ${cy})`}>
          <circle
            cx="0"
            cy="0"
            r={radius}
            fill="none"
            stroke={BRAND_COLORS.black}
            strokeOpacity="0.14"
            strokeWidth="34"
            strokeDasharray={`${maxArcLength} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(${START_ANGLE_DEG})`}
          />

          <circle
            cx="0"
            cy="0"
            r={radius}
            fill="none"
            stroke={`url(#thresholdGradient)`}
            strokeWidth="34"
            strokeDasharray={`${progressArcLength} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(${START_ANGLE_DEG})`}
          />

          <g transform={`rotate(${thresholdAngle}) translate(${radius} 0) scale(${markerPulse})`}>
            <circle cx="0" cy="0" r="18" fill={BRAND_COLORS.pink} />
            <circle cx="0" cy="0" r="8" fill={BRAND_COLORS.black} />
          </g>
        </g>

        <text
          x="960"
          y="540"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={BRAND_FONTS.primary}
          fontSize="220"
          fontWeight="700"
          letterSpacing="-4"
          fill={BRAND_COLORS.black}
        >
          {countValue}%
        </text>
        <text
          x="960"
          y="650"
          textAnchor="middle"
          fontFamily={BRAND_FONTS.secondary}
          fontSize="42"
          fontWeight="600"
          letterSpacing="8"
          fill={BRAND_COLORS.textSecondary}
        >
          MAX THRESHOLD
        </text>

        <defs>
          <linearGradient id="thresholdGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={BRAND_COLORS.pink} />
            <stop offset="100%" stopColor={BRAND_COLORS.yellow} />
          </linearGradient>
        </defs>
      </svg>
    </AbsoluteFill>
  );
};

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