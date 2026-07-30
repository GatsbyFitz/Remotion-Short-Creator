import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BRAND_COLORS } from "../theme";

const SKIN_LEFT = 460;
const SKIN_RIGHT = 1460;
const SKIN_Y = 640;
const DERMIS_Y = 700;

const BLISTER_LEFT = 860;
const BLISTER_RIGHT = 1060;
const BLISTER_CENTER = (BLISTER_LEFT + BLISTER_RIGHT) / 2;
const MAX_BUMP_HEIGHT = 70;

const SHOE_AMPLITUDE = 26;
const FRICTION_FADE_IN = [0, 20] as const;
const FRICTION_FADE_OUT = [80, 110] as const;

const GROW_START = 50;
const GROW_END = 150;
const HOLD_START = 150;
const HOLD_END = 170;

export const BlisterFormation: React.FC = () => {
  const frame = useCurrentFrame();

  const shoeAmplitude = interpolate(
    frame,
    [FRICTION_FADE_IN[0], FRICTION_FADE_IN[1], FRICTION_FADE_OUT[0], FRICTION_FADE_OUT[1]],
    [0, SHOE_AMPLITUDE, SHOE_AMPLITUDE, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const shoeOffsetX = Math.sin(frame * 0.35) * shoeAmplitude;

  const gapProgress = interpolate(frame, [GROW_START, GROW_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const bumpHeight = gapProgress * MAX_BUMP_HEIGHT;

  const pulse = interpolate(
    frame,
    [HOLD_START, (HOLD_START + HOLD_END) / 2, HOLD_END],
    [1, 1.05, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const epidermisPath = `M${SKIN_LEFT},${SKIN_Y} L${BLISTER_LEFT},${SKIN_Y} Q${BLISTER_CENTER},${
    SKIN_Y - bumpHeight * 1.6
  } ${BLISTER_RIGHT},${SKIN_Y} L${SKIN_RIGHT},${SKIN_Y}`;

  const fluidPath = `M${BLISTER_LEFT},${SKIN_Y} Q${BLISTER_CENTER},${
    SKIN_Y - bumpHeight * 1.6
  } ${BLISTER_RIGHT},${SKIN_Y} Z`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" role="img" aria-label="How friction creates a heel blister">
        <line
          x1={SKIN_LEFT}
          y1={DERMIS_Y}
          x2={SKIN_RIGHT}
          y2={DERMIS_Y}
          stroke={BRAND_COLORS.yellow}
          strokeOpacity="0.35"
          strokeWidth="4"
        />

        <g
          transform={`translate(${BLISTER_CENTER} ${SKIN_Y}) scale(${pulse}) translate(${-BLISTER_CENTER} ${-SKIN_Y})`}
        >
          {bumpHeight > 1 ? (
            <path d={fluidPath} fill={BRAND_COLORS.pink} fillOpacity="0.55" />
          ) : null}

          <path
            d={epidermisPath}
            stroke={BRAND_COLORS.yellow}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        <g transform={`translate(${shoeOffsetX}, ${-bumpHeight})`}>
          <rect
            x={BLISTER_LEFT}
            y={460}
            width={BLISTER_RIGHT - BLISTER_LEFT}
            height={150}
            rx="28"
            fill="none"
            stroke={BRAND_COLORS.yellow}
            strokeWidth="5"
          />
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
