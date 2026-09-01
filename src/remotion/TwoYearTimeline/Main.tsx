import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

const TOTAL_MONTHS = 24;
const YEAR_MARKS = [0, 12, 24];

export const TwoYearTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const markerScale = spring({
    fps,
    frame,
    config: {
      damping: 16,
      mass: 0.8,
      stiffness: 140,
    },
  });

  const timelineWidth = 1320;
  const startX = 300;
  const lineY = 620;
  const markerX = startX + progress * timelineWidth;
  const currentMonth = Math.round(progress * TOTAL_MONTHS);

  const monthPositions = Array.from({ length: TOTAL_MONTHS + 1 }, (_, month) => {
    const x = startX + (month / TOTAL_MONTHS) * timelineWidth;
    const isYearMark = YEAR_MARKS.includes(month);

    return { month, x, isYearMark };
  });

  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" role="img" aria-label="Two year timeline progression">

        <rect
          x={startX}
          y={lineY - 6}
          width={timelineWidth}
          height="12"
          rx="999"
          fill={BRAND_COLORS.trackLine}
        />
        <rect
          x={startX}
          y={lineY - 6}
          width={timelineWidth * progress}
          height="12"
          rx="999"
          fill="url(#progressLine)"
        />

        {monthPositions.map(({ month, x, isYearMark }) => {
          const monthProgress = month / TOTAL_MONTHS;
          const isPassed = progress >= monthProgress;
          const tickHeight = isYearMark ? 62 : 24;
          const labelOpacity = interpolate(frame, [16 + month * 2, 16 + month * 2 + 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <React.Fragment key={month}>
              <line
                x1={x}
                y1={lineY - 10}
                x2={x}
                y2={lineY - 10 - tickHeight}
                stroke={isPassed ? BRAND_COLORS.yellow : "rgba(255, 255, 255, 0.18)"}
                strokeWidth={isYearMark ? 4 : 3}
                strokeLinecap="round"
              />

              {isYearMark ? (
                <g opacity={labelOpacity}>
                  <text
                    x={x}
                    y={lineY - tickHeight - 82}
                    fill={isPassed ? BRAND_COLORS.yellow : BRAND_COLORS.textLight}
                    fontFamily={BRAND_FONTS.secondary}
                    fontSize="24"
                    fontWeight="800"
                    letterSpacing="4"
                    textAnchor="middle"
                    paintOrder="stroke fill"
                    strokeWidth="2.5"
                  >
                    {month === 0 ? "START" : month === 12 ? "YEAR 1" : "YEAR 2"}
                  </text>
                  <text
                    x={x}
                    y={lineY - tickHeight - 42}
                    fill={isPassed ? BRAND_COLORS.yellow : BRAND_COLORS.textLight}
                    fontFamily={BRAND_FONTS.primary}
                    fontSize="38"
                    fontWeight="900"
                    letterSpacing="-1"
                    textAnchor="middle"
                    paintOrder="stroke fill"
                    strokeWidth="3"
                  >
                    {month / 12}
                  </text>
                </g>
              ) : null}
            </React.Fragment>
          );
        })}

        <circle
          cx={markerX}
          cy={lineY - 6}
          r={32 * markerScale}
          fill={BRAND_COLORS.pink}
        />
        <circle
          cx={markerX}
          cy={lineY - 6}
          r={52 * markerScale}
          fill="none"
          stroke="rgba(255, 55, 161, 0.28)"
          strokeWidth="16"
        />
        <circle
          cx={markerX}
          cy={lineY - 6}
          r={18 * markerScale}
          fill={BRAND_COLORS.yellow}
          opacity="0.95"
        />

        <text
          x={markerX}
          y={lineY + 78}
          fill={BRAND_COLORS.yellow}
          fontFamily={BRAND_FONTS.secondary}
          fontSize="24"
          fontWeight="800"
          letterSpacing="3"
          textAnchor="middle"
          paintOrder="stroke fill"
          strokeWidth="2"
        >
          MONTH {currentMonth}
        </text>
      </svg>
    </AbsoluteFill>
  );
};

export const calculateTwoYearTimelineMetadata = async () => {
  return {
    fps: 30,
    durationInFrames: 150,
    width: 1920,
    height: 1080,
    defaultCodec: "prores" as const,
    defaultVideoImageFormat: "png" as const,
    defaultPixelFormat: "yuva444p10le" as const,
    defaultProResProfile: "4444" as const,
  } as const;
};