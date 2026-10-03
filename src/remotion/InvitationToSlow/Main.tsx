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
const DURATION_IN_FRAMES = 232;

const BUILD_END = 30;
const CAUGHT_FRAME = 98;
const SLIDE_START = 108;
const SLIDE_END = 142;
const RESUME_FRAME = 142;

const PIVOT = { x: 960, y: 790 };
const ARM_TIP = 470;

// A metronome slows by moving its weight further from the pivot, which is the
// whole composition in one gesture: nothing is taken away, one thing is moved.
const WEIGHT_NEAR = 120;
const WEIGHT_FAR = 340;

const FAST_PERIOD = 11;
const SLOW_PERIOD = 38;
const FAST_SWING = 29;
const SLOW_SWING = 21;

const TEXT_SHADOW = "0 4px 20px rgba(0, 0, 0, 0.55)";

// Zero while the arm is held, so the swing simply stops rather than easing out.
const runningAt = (f: number) => (f >= CAUGHT_FRAME && f < RESUME_FRAME ? 0 : 1);

const periodAt = (f: number) =>
  interpolate(f, [SLIDE_START, SLIDE_END], [FAST_PERIOD, SLOW_PERIOD], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

// Phase is accumulated rather than computed from the frame, because the tempo
// changes partway through — sin(frame * omega) would jump the arm to a new
// position the instant omega changed.
const phaseAt = (frame: number) => {
  let phase = 0;
  for (let f = 0; f <= frame; f++) {
    phase += (runningAt(f) * 2 * Math.PI) / periodAt(f);
  }
  return phase;
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

export const InvitationToSlow: React.FC = () => {
  const frame = useCurrentFrame();

  const build = interpolate(frame, [0, BUILD_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const slide = interpolate(frame, [SLIDE_START, SLIDE_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.3, 0, 0.2, 1),
  });

  const swingLimit = interpolate(slide, [0, 1], [FAST_SWING, SLOW_SWING]);
  const angle = swingLimit * Math.sin(phaseAt(frame));

  const weightDistance = interpolate(slide, [0, 1], [WEIGHT_NEAR, WEIGHT_FAR]);

  // The arm carries the state: the unsustainable tempo, then the one that lasts.
  const armColor = interpolateColors(slide, [0, 1], [BRAND_COLORS.pink, BRAND_COLORS.yellow]);

  const injuryOpacity =
    interpolate(frame, [CAUGHT_FRAME, CAUGHT_FRAME + 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(frame, [SLIDE_END - 12, SLIDE_END + 6], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return (
    <AbsoluteFill>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        role="img"
        aria-label="A metronome beating fast, stopped by injury, then set to a slower sustainable tempo"
        style={{ filter: "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5))" }}
      >
        {/* Body. Never changes — the thing itself is not the problem. */}
        <path
          d="M 812 884 L 1108 884 L 1016 470 L 904 470 Z"
          fill="none"
          stroke={BRAND_COLORS.light}
          strokeWidth={8}
          strokeLinejoin="round"
          opacity={build}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - build}
        />

        <g transform={`rotate(${angle} ${PIVOT.x} ${PIVOT.y})`} opacity={build}>
          <line
            x1={PIVOT.x}
            y1={PIVOT.y}
            x2={PIVOT.x}
            y2={PIVOT.y - ARM_TIP}
            stroke={armColor}
            strokeWidth={7}
            strokeLinecap="round"
          />

          {/* The weight. Sliding it up is the entire instruction. */}
          <rect
            x={PIVOT.x - 34}
            y={PIVOT.y - weightDistance - 22}
            width={68}
            height={44}
            rx={5}
            fill={armColor}
          />
        </g>

        <circle cx={PIVOT.x} cy={PIVOT.y} r={10} fill={BRAND_COLORS.light} opacity={build} />

        <text
          x={960}
          y={360}
          textAnchor="middle"
          style={{
            fontFamily: BRAND_FONTS.primary,
            fontSize: 46,
            fontWeight: 600,
            letterSpacing: 5,
            fill: BRAND_COLORS.pink,
            opacity: injuryOpacity,
            textShadow: TEXT_SHADOW,
          }}
        >
          INJURY
        </text>

        {/* The same instrument either side of it — only the setting changed. */}
        <text
          x={960}
          y={968}
          textAnchor="middle"
          style={{
            fontFamily: BRAND_FONTS.primary,
            fontSize: 42,
            fontWeight: 600,
            letterSpacing: 6,
            fill: BRAND_COLORS.pink,
            opacity:
              interpolate(frame, [40, 56], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }) *
              interpolate(frame, [CAUGHT_FRAME - 4, CAUGHT_FRAME + 8], [1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            textShadow: TEXT_SHADOW,
          }}
        >
          BEFORE
        </text>

        <text
          x={960}
          y={968}
          textAnchor="middle"
          style={{
            fontFamily: BRAND_FONTS.primary,
            fontSize: 42,
            fontWeight: 600,
            letterSpacing: 6,
            fill: BRAND_COLORS.yellow,
            opacity: interpolate(frame, [SLIDE_END - 2, SLIDE_END + 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            textShadow: TEXT_SHADOW,
          }}
        >
          NOW
        </text>

      </svg>
    </AbsoluteFill>
  );
};
