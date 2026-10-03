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
const DURATION_IN_FRAMES = 248;

const BUILD_END = 36;
const LOAD_ONE = { rise: 44, peak: 66, fall: 82, rest: 96 };
const BRACE_START = 104;
const BRACE_SPACING = 20;
const LOAD_TWO = { rise: 192, peak: 214 };

const FRAME_LEFT = 790;
const FRAME_RIGHT = 1090;
const BASE_Y = 880;
const BAY_HEIGHT = 165;
const BAYS = 4;

// How far the top of an unbraced frame travels sideways under load. A frame of
// uprights and horizontals alone has nothing to resist this — it just leans.
const MAX_SHIFT = 150;
// What the braces take out of that. Not all of it: cross-training doesn't make a
// body rigid, it makes it hold its shape.
const BRACE_EFFECT = 0.9;

const BRACES = ["Strength", "Mobility", "Cycling", "Swimming"] as const;

const levelY = (level: number) => BASE_Y - level * BAY_HEIGHT;

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

export const CrossBracedBody: React.FC = () => {
  const frame = useCurrentFrame();

  const build = interpolate(frame, [0, BUILD_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // The same load, applied twice: once to a frame with nothing holding its
  // corners, once after the braces are in.
  const loadOne = interpolate(
    frame,
    [LOAD_ONE.rise, LOAD_ONE.peak, LOAD_ONE.fall, LOAD_ONE.rest],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.3, 1) },
  );
  const loadTwo = interpolate(frame, [LOAD_TWO.rise, LOAD_TWO.peak], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.3, 1),
  });
  const load = Math.max(loadOne, loadTwo);

  // Each brace draws itself into its bay, bottom-left to top-right.
  const braceProgress = BRACES.map((_, index) =>
    interpolate(
      frame,
      [BRACE_START + index * BRACE_SPACING, BRACE_START + index * BRACE_SPACING + 16],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) },
    ),
  );
  const bracedFraction = braceProgress.reduce((sum, p) => sum + p, 0) / BAYS;

  // Racking is shared out up the frame: the base stays put, the top moves most.
  const topShift = load * MAX_SHIFT * (1 - BRACE_EFFECT * bracedFraction);
  const shiftAt = (level: number) => (topShift * level) / BAYS;

  const node = (side: "left" | "right", level: number) => ({
    x: (side === "left" ? FRAME_LEFT : FRAME_RIGHT) + shiftAt(level),
    y: levelY(level),
  });

  // The frame reports its own state: white while it holds its shape, pink as it
  // leans. Driven by the actual deformation, not by which phase we're in.
  const strain = Math.min(1, Math.abs(topShift) / MAX_SHIFT);
  const frameColor = interpolateColors(
    interpolate(strain, [0.2, 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    [0, 1],
    [BRAND_COLORS.light, BRAND_COLORS.pink],
  );

  // Flips as soon as the first brace lands — that's the moment it stops being
  // one thing only.
  const switched = interpolate(bracedFraction, [0.05, 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const levels = Array.from({ length: BAYS + 1 }, (_, i) => i);
  const visibleLevels = Math.round(build * BAYS);

  return (
    <AbsoluteFill>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        role="img"
        aria-label="An unbraced frame leaning under load, then holding its shape once cross-braces are added"
        style={{ filter: "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5))" }}
      >
        {/* Ground. The base never moves. */}
        <line
          x1={FRAME_LEFT - 190}
          y1={BASE_Y}
          x2={FRAME_RIGHT + 190}
          y2={BASE_Y}
          stroke={BRAND_COLORS.light}
          strokeWidth={5}
          opacity={0.5 * build}
        />

        {(["left", "right"] as const).map((side) => (
          <polyline
            key={side}
            points={levels
              .filter((l) => l <= visibleLevels)
              .map((l) => {
                const p = node(side, l);
                return `${p.x},${p.y}`;
              })
              .join(" ")}
            fill="none"
            stroke={frameColor}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {levels
          .filter((l) => l <= visibleLevels)
          .map((l) => {
            const a = node("left", l);
            const b = node("right", l);
            return (
              <line
                key={l}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={frameColor}
                strokeWidth={9}
                strokeLinecap="round"
              />
            );
          })}

        {/* The cross-training itself: a diagonal in each bay, tying two corners
            together so the bay can't fold. */}
        {BRACES.map((label, bay) => {
          const from = node("left", bay);
          const to = node("right", bay + 1);
          const progress = braceProgress[bay];
          if (progress <= 0) return null;

          return (
            <g key={label}>
              <line
                x1={from.x}
                y1={from.y}
                x2={from.x + (to.x - from.x) * progress}
                y2={from.y + (to.y - from.y) * progress}
                stroke={BRAND_COLORS.yellow}
                strokeWidth={7}
                strokeLinecap="round"
              />
              <text
                x={FRAME_RIGHT + shiftAt(bay + 0.5) + 48}
                y={levelY(bay + 0.5)}
                dominantBaseline="middle"
                style={{
                  fontFamily: BRAND_FONTS.primary,
                  fontSize: 34,
                  fontWeight: 600,
                  fill: BRAND_COLORS.yellow,
                  opacity: progress,
                  textShadow: TEXT_SHADOW,
                }}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* The load, pushing at the top where it has the most leverage. */}
        <g opacity={load}>
          <line
            x1={FRAME_LEFT - 250}
            y1={levelY(BAYS)}
            x2={FRAME_LEFT + shiftAt(BAYS) - 26}
            y2={levelY(BAYS)}
            stroke={BRAND_COLORS.pink}
            strokeWidth={7}
            strokeLinecap="round"
          />
          <path
            d={`M ${FRAME_LEFT + shiftAt(BAYS) - 8} ${levelY(BAYS)} l -26 -15 l 0 30 z`}
            fill={BRAND_COLORS.pink}
          />
        </g>

        {([
          { text: "RUNNING ONLY", shown: 1 - switched },
          { text: "CROSS-TRAINED", shown: switched },
        ] as const).map((entry) => (
          <text
            key={entry.text}
            x={(FRAME_LEFT + FRAME_RIGHT) / 2}
            y={BASE_Y + 62}
            textAnchor="middle"
            style={{
              fontFamily: BRAND_FONTS.primary,
              fontSize: 38,
              fontWeight: 600,
              letterSpacing: 3,
              fill: entry.text === "CROSS-TRAINED" ? BRAND_COLORS.yellow : BRAND_COLORS.light,
              opacity: build * entry.shown,
              textShadow: TEXT_SHADOW,
            }}
          >
            {entry.text}
          </text>
        ))}

      </svg>
    </AbsoluteFill>
  );
};
