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
const DURATION_IN_FRAMES = 226;

const BUILD_END = 40;
const RELEASE_START = 72;
const RELEASE_SPACING = 32;
const RELEASE_LENGTH = 34;
const HEAL_IN = 172;

const CENTRE = { x: 960, y: 530 };

// Squeezed to almost nothing by the fight, opened once it stops. The room isn't
// created at the end — it was always the space the resistance was standing in.
const CORE_SQUEEZED = 50;
const CORE_OPEN = 232;

// In the order the line names them.
const FORCES = [
  { label: "PAUSE", angle: -90 },
  { label: "BREAK", angle: 30 },
  { label: "INJURY", angle: 150 },
] as const;

const ARROW_GAP = 22;
const ARROW_LENGTH = 165;
const RETRACT_BY = 240;

const TEXT_SHADOW = "0 4px 20px rgba(0, 0, 0, 0.55)";

const along = (angleDeg: number, distance: number) => {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CENTRE.x + Math.cos(a) * distance, y: CENTRE.y + Math.sin(a) * distance };
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

export const RoomToHeal: React.FC = () => {
  const frame = useCurrentFrame();

  const build = interpolate(frame, [0, BUILD_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const released = FORCES.map((_, i) =>
    interpolate(
      frame,
      [RELEASE_START + i * RELEASE_SPACING, RELEASE_START + i * RELEASE_SPACING + RELEASE_LENGTH],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.3, 0, 0.2, 1) },
    ),
  );

  const openness = released.reduce((sum, r) => sum + r, 0) / FORCES.length;

  // Straining while it's still being held. Stops the instant the pressure does.
  const strain = (1 - openness) * Math.sin(frame * 0.55) * 3;
  const coreRadius = interpolate(openness, [0, 1], [CORE_SQUEEZED, CORE_OPEN]) * build + strain;

  // Driven by the LAST force to let go, not the average. Interpolating across a
  // partial release ran the core through a muddy beige for a third of the shot,
  // and it's truer anyway: it isn't healing while one of them is still pressing.
  const allReleased = Math.min(...released);
  const coreColor = interpolateColors(
    interpolate(allReleased, [0.35, 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    [0, 1],
    [BRAND_COLORS.pink, BRAND_COLORS.yellow],
  );

  const healIn = interpolate(frame, [HEAL_IN, HEAL_IN + 22], [0, 1], {
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
        aria-label="Three forces pressing a space shut, withdrawing one by one until there is room to heal"
        style={{ filter: "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5))" }}
      >
        <circle
          cx={CENTRE.x}
          cy={CENTRE.y}
          r={Math.max(0, coreRadius)}
          fill={coreColor}
          fillOpacity={interpolate(openness, [0, 1], [0.18, 0.3])}
          stroke={coreColor}
          strokeWidth={8}
          opacity={build}
        />

        {FORCES.map((force, i) => {
          const retract = released[i] * RETRACT_BY;
          const headDistance = coreRadius + ARROW_GAP + retract;
          const tailDistance = headDistance + ARROW_LENGTH;

          const head = along(force.angle, headDistance);
          const tail = along(force.angle, tailDistance);
          const label = along(force.angle, tailDistance + 56);

          // Arrowhead drawn in the arrow's own frame, then rotated to face in.
          const opacity = build * (1 - released[i]);

          return (
            <g key={force.label} opacity={opacity}>
              <line
                x1={tail.x}
                y1={tail.y}
                x2={head.x}
                y2={head.y}
                stroke={BRAND_COLORS.pink}
                strokeWidth={9}
                strokeLinecap="round"
              />
              {/* The triangle already points along -x, so it needs `angle`, not
                  `angle + 180` — the extra half turn aimed it away from the core. */}
              <g transform={`translate(${head.x} ${head.y}) rotate(${force.angle})`}>
                <path d="M 0 0 l 28 -15 l 0 30 z" fill={BRAND_COLORS.pink} />
              </g>
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  fontFamily: BRAND_FONTS.primary,
                  fontSize: 38,
                  fontWeight: 600,
                  letterSpacing: 4,
                  fill: BRAND_COLORS.pink,
                  textShadow: TEXT_SHADOW,
                }}
              >
                {force.label}
              </text>
            </g>
          );
        })}

        <text
          x={CENTRE.x}
          y={CENTRE.y + 4}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: BRAND_FONTS.primary,
            fontSize: 62,
            fontWeight: 600,
            letterSpacing: 8,
            fill: BRAND_COLORS.light,
            opacity: healIn,
            textShadow: TEXT_SHADOW,
          }}
        >
          HEAL
        </text>
      </svg>
    </AbsoluteFill>
  );
};
