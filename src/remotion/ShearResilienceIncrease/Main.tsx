import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BRAND_COLORS } from "../theme";

const LAYER_LEFT = 660;
const LAYER_RIGHT = 1260;
const TOP_LAYER_Y = 480;
const BOTTOM_LAYER_Y = 600;
const LAYER_HEIGHT = 60;

const AMPLITUDE = 90;
const ANGULAR_SPEED = 0.12;

export const ShearResilienceIncrease: React.FC = () => {
  const frame = useCurrentFrame();

  // The applied shear itself stays constant — this strategy is about the
  // material withstanding it, not about reducing it.
  const offsetX = AMPLITUDE * Math.sin(ANGULAR_SPEED * frame);

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" role="img" aria-label="Increasing resilience to repetitive shear deformation">
        <rect
          x={LAYER_LEFT}
          y={BOTTOM_LAYER_Y}
          width={LAYER_RIGHT - LAYER_LEFT}
          height={LAYER_HEIGHT}
          rx="10"
          fill={BRAND_COLORS.yellow}
          fillOpacity="0.55"
          stroke={BRAND_COLORS.yellow}
          strokeWidth="4"
        />

        <line
          x1={LAYER_LEFT}
          y1={(TOP_LAYER_Y + LAYER_HEIGHT + BOTTOM_LAYER_Y) / 2}
          x2={LAYER_RIGHT}
          y2={(TOP_LAYER_Y + LAYER_HEIGHT + BOTTOM_LAYER_Y) / 2}
          stroke={BRAND_COLORS.black}
          strokeWidth="6"
          strokeLinecap="round"
        />

        <rect
          x={LAYER_LEFT + offsetX}
          y={TOP_LAYER_Y}
          width={LAYER_RIGHT - LAYER_LEFT}
          height={LAYER_HEIGHT}
          rx="10"
          fill={BRAND_COLORS.pink}
          fillOpacity="0.55"
          stroke={BRAND_COLORS.pink}
          strokeWidth="4"
        />
      </svg>
    </AbsoluteFill>
  );
};

export const calculateMetadata = async () => {
  return {
    fps: 30,
    durationInFrames: 180,
    width: 1920,
    height: 1080,
    defaultCodec: "prores" as const,
    defaultVideoImageFormat: "png" as const,
    defaultPixelFormat: "yuva444p10le" as const,
    defaultProResProfile: "4444" as const,
  } as const;
};
