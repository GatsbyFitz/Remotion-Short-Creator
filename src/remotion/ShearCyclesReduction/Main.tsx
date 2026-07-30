import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BRAND_COLORS } from "../theme";

const CENTER_X = 960;
const CENTER_Y = 540;
const RADIUS = 150;
const ARC_HALF_SPAN = 42; // degrees on each side of an arrow's own center angle
const ARROW_COUNT = 3;

// Rotation slows down over time (sqrt-of-frame phase, offset to avoid an
// infinite initial spin) — fewer cycles happening per unit time.
const ROTATION_SCALE = 200;
const FRAME_OFFSET = 30;

const toRad = (deg: number) => (deg * Math.PI) / 180;

const pointOnCircle = (angleDeg: number, radius: number) => {
  const rad = toRad(angleDeg - 90);
  return {
    x: CENTER_X + radius * Math.cos(rad),
    y: CENTER_Y + radius * Math.sin(rad),
  };
};

const buildArrowPath = (centerAngle: number) => {
  const start = pointOnCircle(centerAngle - ARC_HALF_SPAN, RADIUS);
  const end = pointOnCircle(centerAngle + ARC_HALF_SPAN, RADIUS);
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 0 1 ${end.x} ${end.y}`;
};

const ARROW_ANGLES = Array.from({ length: ARROW_COUNT }, (_, i) => (360 / ARROW_COUNT) * i);

export const ShearCyclesReduction: React.FC = () => {
  const frame = useCurrentFrame();

  const rotation = ROTATION_SCALE * Math.sqrt(frame + FRAME_OFFSET);

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" role="img" aria-label="Reducing the number of shear cycles">
        <g transform={`rotate(${rotation} ${CENTER_X} ${CENTER_Y})`}>
          {ARROW_ANGLES.map((angle) => (
            <path
              key={angle}
              d={buildArrowPath(angle)}
              fill="none"
              stroke={BRAND_COLORS.yellow}
              strokeWidth="22"
              strokeLinecap="round"
            />
          ))}
        </g>
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
