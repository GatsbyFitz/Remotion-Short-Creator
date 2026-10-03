import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  useCurrentFrame,
} from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

const BASE_FPS = 30;
const DURATION_IN_FRAMES = 230;

const AXES_END = 34;
const ZONE_START = 30;
const DOT_IN = 58;
const JOURNEY_START = 96;
const JOURNEY_END = 178;
const LABEL_IN = 186;

const PLOT_LEFT = 620;
const PLOT_RIGHT = 1320;
const PLOT_TOP = 200;
const PLOT_BOTTOM = 880;
const MID_X = (PLOT_LEFT + PLOT_RIGHT) / 2;
const MID_Y = (PLOT_TOP + PLOT_BOTTOM) / 2;

// The two lessons aren't a sequence, they're two independent axes — which is why
// this is a field to cross rather than a list to work through. Low on both is
// where the whole story started.
const JOURNEY = [
  { x: 700, y: 790 },
  { x: 860, y: 680 },
  { x: 980, y: 460 },
  { x: 1180, y: 330 },
] as const;

const SAMPLES = 120;

const bezierAt = (t: number) => {
  const [p0, p1, p2, p3] = JOURNEY;
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};

// Sampled rather than revealed with a dash offset, so the dot sits exactly on the
// end of its own trail instead of drifting ahead of it.
const TRAIL = Array.from({ length: SAMPLES + 1 }, (_, i) => bezierAt(i / SAMPLES));

const TEXT_SHADOW = "0 4px 20px rgba(0, 0, 0, 0.55)";

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

export const ListenAndVary: React.FC = () => {
  const frame = useCurrentFrame();

  const axes = interpolate(frame, [0, AXES_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const zone = interpolate(frame, [ZONE_START, ZONE_START + 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dotIn = interpolate(frame, [DOT_IN, DOT_IN + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const journey = interpolate(frame, [JOURNEY_START, JOURNEY_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.25, 1),
  });

  const labelIn = interpolate(frame, [LABEL_IN, LABEL_IN + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const travelled = TRAIL.slice(0, Math.max(1, Math.round(journey * SAMPLES) + 1));
  const head = travelled[travelled.length - 1];
  const dotColor = interpolateColors(journey, [0, 1], [BRAND_COLORS.pink, BRAND_COLORS.yellow]);

  return (
    <AbsoluteFill>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        role="img"
        aria-label="Listening and variety as two axes, with a journey from low on both to high on both"
        style={{ filter: "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5))" }}
      >
        {/* The quadrant worth being in, established before the journey starts. */}
        <rect
          x={MID_X}
          y={PLOT_TOP}
          width={PLOT_RIGHT - MID_X}
          height={MID_Y - PLOT_TOP}
          fill={BRAND_COLORS.yellow}
          opacity={0.16 * zone}
        />

        <g opacity={0.3 * zone}>
          <line x1={MID_X} y1={PLOT_TOP} x2={MID_X} y2={PLOT_BOTTOM} stroke={BRAND_COLORS.light} strokeWidth={2} strokeDasharray="10 12" />
          <line x1={PLOT_LEFT} y1={MID_Y} x2={PLOT_RIGHT} y2={MID_Y} stroke={BRAND_COLORS.light} strokeWidth={2} strokeDasharray="10 12" />
        </g>

        {/* Axes, drawn out from the origin. */}
        <line
          x1={PLOT_LEFT}
          y1={PLOT_BOTTOM}
          x2={PLOT_LEFT}
          y2={PLOT_BOTTOM - (PLOT_BOTTOM - PLOT_TOP) * axes}
          stroke={BRAND_COLORS.light}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <line
          x1={PLOT_LEFT}
          y1={PLOT_BOTTOM}
          x2={PLOT_LEFT + (PLOT_RIGHT - PLOT_LEFT) * axes}
          y2={PLOT_BOTTOM}
          stroke={BRAND_COLORS.light}
          strokeWidth={6}
          strokeLinecap="round"
        />

        <g
          opacity={interpolate(axes, [0.88, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
          fill={BRAND_COLORS.light}
        >
          <path d={`M ${PLOT_LEFT} ${PLOT_TOP - 14} l -11 22 l 22 0 z`} />
          <path d={`M ${PLOT_RIGHT + 14} ${PLOT_BOTTOM} l -22 -11 l 0 22 z`} />
        </g>

        <text
          x={MID_X}
          y={PLOT_BOTTOM + 74}
          textAnchor="middle"
          style={{
            fontFamily: BRAND_FONTS.primary,
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: 5,
            fill: BRAND_COLORS.light,
            opacity: axes,
            textShadow: TEXT_SHADOW,
          }}
        >
          VARIETY
        </text>

        <text
          x={PLOT_LEFT - 56}
          y={MID_Y}
          textAnchor="middle"
          transform={`rotate(-90 ${PLOT_LEFT - 56} ${MID_Y})`}
          style={{
            fontFamily: BRAND_FONTS.primary,
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: 5,
            fill: BRAND_COLORS.light,
            opacity: axes,
            textShadow: TEXT_SHADOW,
          }}
        >
          LISTENING
        </text>

        {/* The route taken, and the dot still on the end of it. */}
        <polyline
          points={travelled.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={BRAND_COLORS.light}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.45 * dotIn}
        />

        <circle cx={head.x} cy={head.y} r={17 * dotIn} fill={dotColor} />

        <text
          x={MID_X + (PLOT_RIGHT - MID_X) / 2}
          y={PLOT_TOP + 56}
          textAnchor="middle"
          style={{
            fontFamily: BRAND_FONTS.primary,
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: 4,
            fill: BRAND_COLORS.yellow,
            opacity: labelIn,
            textShadow: TEXT_SHADOW,
          }}
        >
          SUSTAINABLE
        </text>
      </svg>
    </AbsoluteFill>
  );
};
