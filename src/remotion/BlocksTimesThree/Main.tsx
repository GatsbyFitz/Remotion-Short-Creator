import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND_COLORS } from "../theme";

const BLOCK_WIDTH = 400;
const BLOCK_HEIGHT = 240;
const BLOCK_RADIUS = 36;
const GRID_GAP = 26;

export const calculateMetadata = async () => {
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

const Block: React.FC<{ opacity: number }> = ({ opacity }) => {
  return (
    <div
      style={{
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        borderRadius: BLOCK_RADIUS,
        backgroundColor: BRAND_COLORS.yellow,
        boxShadow: "0 18px 40px rgba(0, 0, 0, 0.18)",
        opacity,
      }}
    />
  );
};

export const BlocksTimesThree: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rowOneStart = 0;
  const rowTwoStart = 18;
  const rowThreeStart = 30;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(3, ${BLOCK_WIDTH}px)`,
          gap: GRID_GAP,
        }}
      >
        {Array.from({ length: 9 }).map((_, index) => {
          const rowIndex = Math.floor(index / 3);
          const rowStart =
            rowIndex === 0
              ? rowOneStart
              : rowIndex === 1
                ? rowTwoStart
                : rowThreeStart;
          const rowOpacity = interpolate(
            frame,
            [rowStart, rowStart + fps / 2],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          );
          const rowRise = interpolate(
            frame,
            [rowStart, rowStart + fps / 2],
            [16, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          );

          return (
            <div
              key={`block-${index}`}
              style={{ transform: `translateY(${rowRise}px)` }}
            >
              <Block opacity={rowOpacity} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
