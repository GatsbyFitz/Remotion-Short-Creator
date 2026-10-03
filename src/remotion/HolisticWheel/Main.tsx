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

const BUILD_END_FRAME = 36;
// A beat to let the lopsided shape land before it fills out.
const FILL_START_FRAME = 52;
const FILL_END_FRAME = 92;
const ROLL_START_FRAME = 100;
const ROLL_END_FRAME = 165;
const DURATION_IN_FRAMES = 178;

const RADIUS = 250;
const LABEL_RADIUS = RADIUS + 74;
const GROUND_Y = 742;
const START_X = 780;

// Each axis carries the value it holds when everything is poured into training,
// and the value it holds once the athlete is built out. Balanced is deliberately
// NOT maxed — the whole point is that training comes down and the wheel still
// goes further.
const AXES = [
  { label: "Training", lopsided: 1.0, balanced: 0.74 },
  { label: "Sleep", lopsided: 0.16, balanced: 0.7 },
  { label: "Nutrition", lopsided: 0.2, balanced: 0.76 },
  { label: "Mind", lopsided: 0.14, balanced: 0.72 },
  { label: "Recovery", lopsided: 0.18, balanced: 0.75 },
  { label: "Relationships", lopsided: 0.13, balanced: 0.7 },
  { label: "Consistency", lopsided: 0.22, balanced: 0.73 },
  { label: "Purpose", lopsided: 0.15, balanced: 0.71 },
] as const;

const STEP_DEG = 360 / AXES.length;
// The radius a balanced wheel rolls on, used for both the arc length it travels
// and the height its centre rides at.
const NOMINAL_RADIUS =
  RADIUS * (AXES.reduce((sum, a) => sum + a.balanced, 0) / AXES.length);

const TEXT_SHADOW = "0 4px 20px rgba(0, 0, 0, 0.55)";

const pointAt = (value: number, index: number, rotationDeg: number, radius: number) => {
  const angle = ((-90 + index * STEP_DEG + rotationDeg) * Math.PI) / 180;
  return { x: Math.cos(angle) * radius * value, y: Math.sin(angle) * radius * value };
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

export const HolisticWheel: React.FC = () => {
  const frame = useCurrentFrame();

  const build = interpolate(frame, [0, BUILD_END_FRAME], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const fill = interpolate(frame, [FILL_START_FRAME, FILL_END_FRAME], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const roll = interpolate(frame, [ROLL_START_FRAME, ROLL_END_FRAME], [0, 250], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });

  const rotation = roll;

  const values = AXES.map((axis) => (axis.lopsided + (axis.balanced - axis.lopsided) * fill) * build);
  const vertices = values.map((value, index) => pointAt(value, index, rotation, RADIUS));

  // The centre rides exactly as high as the shape's lowest point, which is what
  // a rolling body actually does. A lopsided shape lurches; a round one doesn't.
  // No judder is authored here — it falls out of the geometry.
  const bottomReach = Math.max(...vertices.map((p) => p.y), 1);
  const centreY = GROUND_Y - bottomReach;
  // Rolling, not sliding: distance travelled is the arc length turned.
  const centreX = START_X + ((roll * Math.PI) / 180) * NOMINAL_RADIUS;

  const shapeColor = interpolateColors(fill, [0, 1], [BRAND_COLORS.pink, BRAND_COLORS.yellow]);
  const labelOpacity = interpolate(frame, [ROLL_START_FRAME, ROLL_START_FRAME + 18], [1, 0], {
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
        aria-label="A lopsided training-only wheel that cannot roll, filling out into a balanced athlete that can"
        style={{ filter: "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5))" }}
      >
        <line
          x1={0}
          y1={GROUND_Y}
          x2={1920}
          y2={GROUND_Y}
          stroke={BRAND_COLORS.light}
          strokeWidth={5}
          opacity={0.55 * build}
        />

        <g transform={`translate(${centreX} ${centreY})`}>
          {/* Spokes, full length, so the gap between them and the shape reads as
              what's missing. */}
          {AXES.map((axis, index) => {
            const outer = pointAt(1, index, rotation, RADIUS);
            return (
              <line
                key={axis.label}
                x1={0}
                y1={0}
                x2={outer.x}
                y2={outer.y}
                stroke={BRAND_COLORS.light}
                strokeWidth={2}
                opacity={0.3 * build}
              />
            );
          })}

          <polygon
            points={vertices.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={shapeColor}
            fillOpacity={0.36}
            stroke={shapeColor}
            strokeWidth={7}
            strokeLinejoin="round"
          />

          {vertices.map((p, index) => (
            <circle key={AXES[index].label} cx={p.x} cy={p.y} r={9} fill={shapeColor} />
          ))}
        </g>

        {/* Labels sit at the spoke ends but stay upright, and drop away once it
            starts rolling — spinning text is unreadable. */}
        {AXES.map((axis, index) => {
          const at = pointAt(1, index, rotation, LABEL_RADIUS);
          const x = centreX + at.x;
          const y = centreY + at.y;
          const anchor = Math.abs(at.x) < 30 ? "middle" : at.x > 0 ? "start" : "end";

          return (
            <text
              key={axis.label}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              style={{
                fontFamily: BRAND_FONTS.primary,
                fontSize: 30,
                fontWeight: 600,
                fill: BRAND_COLORS.light,
                opacity: labelOpacity * build,
                textShadow: TEXT_SHADOW,
              }}
            >
              {axis.label}
            </text>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
