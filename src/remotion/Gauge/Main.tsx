import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

export type PushUpGaugeProps = {
  count?: number;
  topLabel?: string;
  bottomLabel?: string;
};

export const GaugeSchema = z.object({
  count: z.number().int().min(0),
  topLabel: z.string(),
  bottomLabel: z.string(),
});

export const Gauge: React.FC<PushUpGaugeProps> = ({
  count = 100,
  topLabel = "PUSH UPS",
  bottomLabel = "IN A ROW",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const value = Math.round(
    interpolate(frame, [0, 4 * fps], [0, count], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    }),
  );

  const progress = interpolate(frame, [0, 4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const radius = 255;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" viewBox="0 0 1080 1080" role="img" aria-label="Circular progress gauge">
        <circle
          cx="540"
          cy="540"
          r={radius}
          fill="none"
          stroke={BRAND_COLORS.black}
          strokeOpacity="0.14"
          strokeWidth="28"
        />
        <circle
          cx="540"
          cy="540"
          r={radius}
          fill="none"
          stroke={BRAND_COLORS.yellow}
          strokeWidth="28"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 540 540)"
        />
        <text
          x="540"
          y="500"
          textAnchor="middle"
          fontFamily={BRAND_FONTS.primary}
          fontSize="180"
          fontWeight="700"
          letterSpacing="-4"
          fill={BRAND_COLORS.yellow}
        >
          {value}
        </text>
        <text
          x="540"
          y="582"
          textAnchor="middle"
          fontFamily={BRAND_FONTS.secondary}
          fontSize="28"
          fontWeight="800"
          letterSpacing="4"
          fill={BRAND_COLORS.yellow}
        >
          {topLabel}
        </text>
        <text
          x="540"
          y="624"
          textAnchor="middle"
          fontFamily={BRAND_FONTS.secondary}
          fontSize="28"
          fontWeight="800"
          letterSpacing="4"
          fill={BRAND_COLORS.yellow}
        >
          {bottomLabel}
        </text>
      </svg>
    </AbsoluteFill>
  );
};

export const calculateGaugeMetadata = async () => {
  return {
    fps: 30,
    durationInFrames: 150,
    width: 1080,
    height: 1080,
    defaultCodec: "prores" as const,
    defaultVideoImageFormat: "png" as const,
    defaultPixelFormat: "yuva444p10le" as const,
    defaultProResProfile: "4444" as const,
  } as const;
};

