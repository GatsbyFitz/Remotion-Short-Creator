import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BRAND_COLORS } from "../theme";

const LAYER_LEFT = 660;
const LAYER_RIGHT = 1260;
const TOP_LAYER_Y = 480;
const BOTTOM_LAYER_Y = 600;
const LAYER_HEIGHT = 60;

const START_AMPLITUDE = 90;
const DECAY_PER_FRAME = 0.014;
const ANGULAR_SPEED = 0.12;

export const ShearMagnitudeReduction: React.FC = () => {
  const frame = useCurrentFrame();

  const amplitude = START_AMPLITUDE * Math.exp(-DECAY_PER_FRAME * frame);
  const offsetX = amplitude * Math.sin(ANGULAR_SPEED * frame);

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" role="img" aria-label="Reducing the magnitude of shear deformation">
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
