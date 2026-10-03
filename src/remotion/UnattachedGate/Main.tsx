import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

const BASE_FPS = 30;
const DURATION_IN_FRAMES = 228;

const FENCE_DRAW_END = 40;
const JOY_IN_START = 38;
const APPROACH_START = 56;
const APPROACH_END = 92;
const BUMP_START = 92;
const FENCE_FADE_START = 118;
const FENCE_FADE_END = 152;
const AROUND_START = 156;
const AROUND_END = 206;

// Seen from above. In plan the barrier is a line you cannot cross and the gate
// is the one gap in it — which is also what makes "just go around" legible
// later, in a way a side-on view never could.
const BARRIER_Y = 560;
const GATE_LEFT = 860;
const GATE_RIGHT = 1060;
const GATE_MID = (GATE_LEFT + GATE_RIGHT) / 2;
const LEAF = (GATE_RIGHT - GATE_LEFT) / 2;

const FENCE_POST_SPACING = 120;
const TICK = 22;

// Posts along both runs of fence, stopping at the gate.
const fencePosts = () => {
  const posts: number[] = [];
  for (let x = GATE_LEFT - FENCE_POST_SPACING; x > 0; x -= FENCE_POST_SPACING) posts.push(x);
  for (let x = GATE_RIGHT + FENCE_POST_SPACING; x < 1920; x += FENCE_POST_SPACING) posts.push(x);
  return posts;
};

const FENCE_POSTS = fencePosts();

// The path stops short of the gate, then later takes the route that was always
// there — through the space where the fence used to be.
const APPROACH_PATH = `M 960 1010 L 960 690`;
const AROUND_PATH =
  `M 960 690 C 1090 690 1230 650 1235 570 C 1240 495 1090 455 960 445 L 960 400`;

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

export const UnattachedGate: React.FC = () => {
  const frame = useCurrentFrame();

  // Drawn outward from the gate, so the barrier appears to close off the frame.
  const fenceDraw = interpolate(frame, [0, FENCE_DRAW_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const fenceOpacity = interpolate(frame, [FENCE_FADE_START, FENCE_FADE_END], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const joyOpacity = interpolate(frame, [JOY_IN_START, JOY_IN_START + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const approach = interpolate(frame, [APPROACH_START, APPROACH_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.3, 0, 0.2, 1),
  });

  // Two short shoves against something that won't open.
  const bump = interpolate(
    frame,
    [BUMP_START, BUMP_START + 5, BUMP_START + 10, BUMP_START + 15, BUMP_START + 20],
    [0, -14, 0, -8, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const around = interpolate(frame, [AROUND_START, AROUND_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });

  return (
    <AbsoluteFill>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        role="img"
        aria-label="A gate demanding suffering before joy, revealed to have no fence attached to it"
        style={{ filter: "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5))" }}
      >
        {/* The fence: the part that turns out not to exist. */}
        <g opacity={fenceOpacity}>
          <line
            x1={GATE_LEFT}
            y1={BARRIER_Y}
            x2={GATE_LEFT - GATE_LEFT * fenceDraw}
            y2={BARRIER_Y}
            stroke={BRAND_COLORS.pink}
            strokeWidth={6}
            strokeLinecap="round"
          />
          <line
            x1={GATE_RIGHT}
            y1={BARRIER_Y}
            x2={GATE_RIGHT + (1920 - GATE_RIGHT) * fenceDraw}
            y2={BARRIER_Y}
            stroke={BRAND_COLORS.pink}
            strokeWidth={6}
            strokeLinecap="round"
          />

          {FENCE_POSTS.map((x) => {
            const distance =
              x < GATE_LEFT ? (GATE_LEFT - x) / GATE_LEFT : (x - GATE_RIGHT) / (1920 - GATE_RIGHT);
            return (
              <line
                key={x}
                x1={x}
                y1={BARRIER_Y - TICK}
                x2={x}
                y2={BARRIER_Y + TICK}
                stroke={BRAND_COLORS.pink}
                strokeWidth={4}
                strokeLinecap="round"
                opacity={fenceDraw > distance ? 1 : 0}
              />
            );
          })}
        </g>

        {/* The gate itself, which stays. Two posts, a closed panel, and the arc
            that says it is a thing meant to be opened. */}
        <g opacity={interpolate(fenceDraw, [0, 0.25], [0, 1], { extrapolateRight: "clamp" })}>
          <path
            d={`M ${GATE_LEFT} ${BARRIER_Y - 44} L ${GATE_LEFT} ${BARRIER_Y + 44}`}
            stroke={BRAND_COLORS.pink}
            strokeWidth={10}
            strokeLinecap="round"
          />
          <path
            d={`M ${GATE_RIGHT} ${BARRIER_Y - 44} L ${GATE_RIGHT} ${BARRIER_Y + 44}`}
            stroke={BRAND_COLORS.pink}
            strokeWidth={10}
            strokeLinecap="round"
          />
          <line
            x1={GATE_LEFT}
            y1={BARRIER_Y}
            x2={GATE_MID - 4}
            y2={BARRIER_Y}
            stroke={BRAND_COLORS.pink}
            strokeWidth={11}
            strokeLinecap="round"
          />
          <line
            x1={GATE_MID + 4}
            y1={BARRIER_Y}
            x2={GATE_RIGHT}
            y2={BARRIER_Y}
            stroke={BRAND_COLORS.pink}
            strokeWidth={11}
            strokeLinecap="round"
          />
          {/* Plan-view swing: the quarter each leaf would travel if it opened. */}
          <path
            d={`M ${GATE_MID} ${BARRIER_Y} A ${LEAF} ${LEAF} 0 0 0 ${GATE_LEFT} ${BARRIER_Y - LEAF}`}
            fill="none"
            stroke={BRAND_COLORS.pink}
            strokeWidth={3}
            strokeDasharray="9 11"
            opacity={0.45}
          />
          <path
            d={`M ${GATE_MID} ${BARRIER_Y} A ${LEAF} ${LEAF} 0 0 1 ${GATE_RIGHT} ${BARRIER_Y - LEAF}`}
            fill="none"
            stroke={BRAND_COLORS.pink}
            strokeWidth={3}
            strokeDasharray="9 11"
            opacity={0.45}
          />
        </g>

        <text
          x={960}
          y={648}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: BRAND_FONTS.primary,
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: 4,
            fill: BRAND_COLORS.pink,
            opacity: interpolate(fenceDraw, [0.4, 0.9], [0, 1], { extrapolateRight: "clamp" }),
            textShadow: TEXT_SHADOW,
          }}
        >
          SUFFERING
        </text>

        {/* Already the right colour, before anyone reaches it. */}
        <text
          x={960}
          y={276}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: BRAND_FONTS.primary,
            fontSize: 92,
            fontWeight: 600,
            fill: BRAND_COLORS.yellow,
            opacity: joyOpacity,
            textShadow: TEXT_SHADOW,
          }}
        >
          JOY
        </text>

        <g transform={`translate(0 ${bump})`}>
          <path
            d={APPROACH_PATH}
            fill="none"
            stroke={BRAND_COLORS.light}
            strokeWidth={6}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - approach}
          />
        </g>

        <path
          d={AROUND_PATH}
          fill="none"
          stroke={BRAND_COLORS.light}
          strokeWidth={6}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - around}
        />
      </svg>
    </AbsoluteFill>
  );
};
