import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BRAND_COLORS } from "../theme";

const BASE_FPS = 30;
const DURATION_IN_FRAMES = 180;

// Placement is calibrated against a still of the talking-head shot: crown of the
// hair at y≈50, head tilted about 4° (eyes 8px higher on the right). It's static —
// it lines up while the head stays near where it was in that frame.
const HEAD_X = 971;
const HEAD_TILT = -4;
const CAP_PIVOT = { x: HEAD_X, y: 168 };
const TASSEL_PIVOT = { x: 1196, y: 77 };

const CAP_LANDS = 16;
const EXIT_START = 165;

const DROP_SHADOW = "drop-shadow(0 6px 16px rgba(0, 0, 0, 0.45))";

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

export const GraduationLesson: React.FC = () => {
  const frame = useCurrentFrame();

  const exit = interpolate(frame, [EXIT_START, DURATION_IN_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  // Dropped from above the frame onto the head.
  const drop = interpolate(frame, [0, CAP_LANDS], [-320, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  const squash = interpolate(
    frame,
    [CAP_LANDS, CAP_LANDS + 4, CAP_LANDS + 8, CAP_LANDS + 12],
    [1, 0.9, 1.03, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // The tassel keeps swinging after the landing and settles on its own.
  const sinceLanding = Math.max(0, frame - CAP_LANDS);
  const swing = frame < CAP_LANDS ? -10 : 24 * Math.exp(-sinceLanding / 16) * Math.sin(sinceLanding * 0.42);

  const capTransform = [
    `translate(0 ${drop - 340 * exit})`,
    `rotate(${HEAD_TILT} ${CAP_PIVOT.x} ${CAP_PIVOT.y})`,
    `translate(${CAP_PIVOT.x} ${CAP_PIVOT.y}) scale(1 ${squash}) translate(${-CAP_PIVOT.x} ${-CAP_PIVOT.y})`,
  ].join(" ");

  return (
    <AbsoluteFill>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        role="img"
        aria-label="A graduation cap dropping onto the speaker's head"
        style={{ filter: DROP_SHADOW }}
      >
        <g transform={capTransform} opacity={1 - exit}>
          {/* Skullcap, sitting low on the head as a real one does. */}
          <path d="M 826 92 L 1116 92 L 1148 160 Q 971 186 794 160 Z" fill="#161616" />

          {/* Board: top face, then its two visible front edges for thickness. */}
          <path d="M 721 74 L 971 110 L 971 124 L 721 88 Z" fill="#000000" />
          <path d="M 971 110 L 1221 74 L 1221 88 L 971 124 Z" fill="#080808" />
          <path d="M 721 74 L 971 38 L 1221 74 L 971 110 Z" fill="#1f1f1f" />

          <path
            d={`M ${HEAD_X} 74 L ${TASSEL_PIVOT.x} ${TASSEL_PIVOT.y}`}
            stroke={BRAND_COLORS.yellow}
            strokeWidth={5}
            strokeLinecap="round"
          />
          <circle cx={HEAD_X} cy={74} r={10} fill={BRAND_COLORS.yellow} />

          <g transform={`rotate(${swing} ${TASSEL_PIVOT.x} ${TASSEL_PIVOT.y})`}>
            <line
              x1={TASSEL_PIVOT.x}
              y1={TASSEL_PIVOT.y}
              x2={TASSEL_PIVOT.x}
              y2={TASSEL_PIVOT.y + 106}
              stroke={BRAND_COLORS.yellow}
              strokeWidth={5}
              strokeLinecap="round"
            />
            <rect x={TASSEL_PIVOT.x - 9} y={TASSEL_PIVOT.y + 104} width={18} height={10} rx={3} fill={BRAND_COLORS.yellow} />
            <path
              d={`M ${TASSEL_PIVOT.x - 8} ${TASSEL_PIVOT.y + 112} L ${TASSEL_PIVOT.x + 8} ${TASSEL_PIVOT.y + 112} L ${TASSEL_PIVOT.x + 15} ${TASSEL_PIVOT.y + 172} L ${TASSEL_PIVOT.x - 15} ${TASSEL_PIVOT.y + 172} Z`}
              fill={BRAND_COLORS.yellow}
            />
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
