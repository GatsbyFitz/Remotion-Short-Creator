import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

const BASE_FPS = 30;
const DURATION_IN_FRAMES = 230;

const AXES_END = 24;
const EXPECTED_START = 30;
const EXPECTED_END = 60;
const REALITY_START = 72;
const REALITY_END = 180;

const ORIGIN = { x: 380, y: 860 };
const X_AXIS_END = 1580;
const Y_AXIS_END = 200;
// Both lines finish at the same place: you still get there, just not straight.
const DESTINATION = { x: 1500, y: 260 };

type Point = { x: number; y: number };

// The route reality takes: setbacks that drop below where it had got to, sudden
// gains, and two places where it loops back over itself.
const REALITY_CONTROL: Point[] = [
  ORIGIN,
  { x: 470, y: 760 },
  { x: 540, y: 820 },
  { x: 600, y: 700 },
  { x: 660, y: 640 },
  { x: 720, y: 700 },
  { x: 660, y: 745 },
  { x: 620, y: 680 },
  { x: 700, y: 600 },
  { x: 790, y: 700 },
  { x: 860, y: 800 },
  { x: 930, y: 720 },
  { x: 990, y: 560 },
  { x: 1060, y: 625 },
  { x: 1130, y: 500 },
  { x: 1190, y: 560 },
  { x: 1130, y: 605 },
  { x: 1090, y: 530 },
  { x: 1180, y: 440 },
  { x: 1260, y: 520 },
  { x: 1330, y: 380 },
  { x: 1400, y: 430 },
  DESTINATION,
];

// Catmull-Rom through the control points, sampled densely so it can be revealed
// by distance along the path. A left-to-right wipe can't reveal a line that loops
// back on itself.
const sampleSpline = (points: Point[], perSegment: number): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
};

const REALITY_PATH = sampleSpline(REALITY_CONTROL, 16);
const CUMULATIVE = REALITY_PATH.reduce<number[]>((acc, p, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + Math.hypot(p.x - REALITY_PATH[i - 1].x, p.y - REALITY_PATH[i - 1].y));
  return acc;
}, []);
const TOTAL_LENGTH = CUMULATIVE[CUMULATIVE.length - 1];

// The travelled part of the path, ending exactly at the current tip.
const travelled = (fraction: number): Point[] => {
  const target = fraction * TOTAL_LENGTH;
  const out: Point[] = [REALITY_PATH[0]];
  for (let i = 1; i < REALITY_PATH.length; i++) {
    if (CUMULATIVE[i] <= target) {
      out.push(REALITY_PATH[i]);
      continue;
    }
    const span = CUMULATIVE[i] - CUMULATIVE[i - 1];
    const t = span ? (target - CUMULATIVE[i - 1]) / span : 0;
    out.push({
      x: REALITY_PATH[i - 1].x + (REALITY_PATH[i].x - REALITY_PATH[i - 1].x) * t,
      y: REALITY_PATH[i - 1].y + (REALITY_PATH[i].y - REALITY_PATH[i - 1].y) * t,
    });
    break;
  }
  return out;
};

const toAttr = (points: Point[]) => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

const TEXT_SHADOW = "0 4px 20px rgba(0, 0, 0, 0.55)";
const LABEL_STYLE = {
  fontFamily: BRAND_FONTS.primary,
  fontSize: 38,
  fontWeight: 600,
  letterSpacing: 5,
  textShadow: TEXT_SHADOW,
} as const;

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

export const ExpectedVsReality: React.FC = () => {
  const frame = useCurrentFrame();

  const axes = interpolate(frame, [0, AXES_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const axisLabels = interpolate(frame, [AXES_END - 8, AXES_END + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const expected = interpolate(frame, [EXPECTED_START, EXPECTED_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.3, 0, 0.3, 1),
  });

  // Reality takes longer than expected, and goes at an uneven pace.
  const reality = interpolate(frame, [REALITY_START, REALITY_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0.05, 0.4, 1),
  });
  const realityPoints = travelled(reality);
  const tip = realityPoints[realityPoints.length - 1];

  const legendIn = (start: number) =>
    interpolate(frame, [start, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        role="img"
        aria-label="A straight expected line of progress over distance beside a very bendy line showing the reality"
        style={{ filter: "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5))" }}
      >
        {/* Axes, drawn out from the origin. */}
        <line
          x1={ORIGIN.x}
          y1={ORIGIN.y}
          x2={ORIGIN.x + (X_AXIS_END - ORIGIN.x) * axes}
          y2={ORIGIN.y}
          stroke={BRAND_COLORS.light}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <line
          x1={ORIGIN.x}
          y1={ORIGIN.y}
          x2={ORIGIN.x}
          y2={ORIGIN.y - (ORIGIN.y - Y_AXIS_END) * axes}
          stroke={BRAND_COLORS.light}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <g fill={BRAND_COLORS.light} opacity={axisLabels}>
          <path d={`M ${X_AXIS_END + 16} ${ORIGIN.y} l -24 -12 l 0 24 z`} />
          <path d={`M ${ORIGIN.x} ${Y_AXIS_END - 16} l -12 24 l 24 0 z`} />
        </g>

        <text x={(ORIGIN.x + X_AXIS_END) / 2} y={ORIGIN.y + 72} textAnchor="middle" style={{ ...LABEL_STYLE, fill: BRAND_COLORS.light, opacity: axisLabels }}>
          DISTANCE
        </text>
        <text
          x={ORIGIN.x - 56}
          y={(ORIGIN.y + Y_AXIS_END) / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${ORIGIN.x - 56} ${(ORIGIN.y + Y_AXIS_END) / 2})`}
          style={{ ...LABEL_STYLE, fill: BRAND_COLORS.light, opacity: axisLabels }}
        >
          PROGRESS
        </text>

        {/* Expected: a straight, even line from start to finish. */}
        <line
          x1={ORIGIN.x}
          y1={ORIGIN.y}
          x2={ORIGIN.x + (DESTINATION.x - ORIGIN.x) * expected}
          y2={ORIGIN.y + (DESTINATION.y - ORIGIN.y) * expected}
          stroke={BRAND_COLORS.light}
          strokeWidth={5}
          strokeDasharray="18 14"
          strokeLinecap="round"
          opacity={expected > 0 ? 0.85 : 0}
        />

        {/* Reality: the same start and finish, by a very different route. */}
        {reality > 0 ? (
          <>
            <polyline
              points={toAttr(realityPoints)}
              fill="none"
              stroke={BRAND_COLORS.yellow}
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={tip.x} cy={tip.y} r={13} fill={BRAND_COLORS.yellow} />
          </>
        ) : null}

        {/* Legend in the empty corner above the start, so neither label ever sits
            on a line. */}
        <g opacity={legendIn(EXPECTED_START)}>
          <line x1={470} y1={262} x2={560} y2={262} stroke={BRAND_COLORS.light} strokeWidth={5} strokeDasharray="18 14" strokeLinecap="round" />
          <text x={590} y={262} dominantBaseline="middle" style={{ ...LABEL_STYLE, fill: BRAND_COLORS.light }}>
            EXPECTED
          </text>
        </g>
        <g opacity={legendIn(REALITY_START)}>
          <path d="M 470 334 C 490 300, 505 368, 525 334 S 545 300, 560 334" fill="none" stroke={BRAND_COLORS.yellow} strokeWidth={7} strokeLinecap="round" />
          <text x={590} y={334} dominantBaseline="middle" style={{ ...LABEL_STYLE, fill: BRAND_COLORS.yellow }}>
            REALITY
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
