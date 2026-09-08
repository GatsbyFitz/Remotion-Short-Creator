import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

const BASE_FPS = 30;

const INTRO_FRAMES = 16;
// The second lap is deliberately quicker than the first: the cycle tightening
// rather than simply repeating.
const FIRST_LAP_FRAMES = 80;
const SECOND_LAP_FRAMES = 48;
const HOLD_FRAMES = 26;

const DURATION_IN_FRAMES =
  INTRO_FRAMES + FIRST_LAP_FRAMES + SECOND_LAP_FRAMES + HOLD_FRAMES;

const CX = 960;
const CY = 540;
const RADIUS = 290;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Length of the bright sweep that travels the ring, as a fraction of the track.
const SWEEP_FRACTION = 0.22;

const toPoint = (angleDeg: number, radius: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
};

// Clockwise from the top. Injury is the only stage that flares pink — it's the
// rupture in an otherwise green loop, so it reads as the thing going wrong.
const STAGES = [
  { label: "Race", color: BRAND_COLORS.yellow, anchor: "middle" as const, dx: 0, dy: -58 },
  { label: "Injury", color: BRAND_COLORS.pink, anchor: "start" as const, dx: 52, dy: 14 },
  { label: "Rest", color: BRAND_COLORS.light, anchor: "middle" as const, dx: 0, dy: 76 },
  { label: "Comeback", color: BRAND_COLORS.yellow, anchor: "end" as const, dx: -52, dy: 14 },
] as const;

// Sits over arbitrary footage, so every mark carries its own contrast.
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

export const RacingInjuryCycle: React.FC = () => {
  const frame = useCurrentFrame();

  const intro = interpolate(frame, [0, INTRO_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // 0 -> 2 over two laps of the ring, the second lap covering the same distance
  // in less time.
  const laps = interpolate(
    frame,
    [
      INTRO_FRAMES,
      INTRO_FRAMES + FIRST_LAP_FRAMES,
      INTRO_FRAMES + FIRST_LAP_FRAMES + SECOND_LAP_FRAMES,
    ],
    [0, 1, 2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const headDeg = laps * 360;

  return (
    <AbsoluteFill>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        role="img"
        aria-label="The cycle of racing and injury"
        style={{ filter: "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.55))" }}
      >
        <defs>
          <linearGradient id="cycleSweep" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={BRAND_COLORS.yellow} />
            <stop offset="100%" stopColor={BRAND_COLORS.pink} />
          </linearGradient>
        </defs>

        {/* The track the cycle runs on. */}
        <circle
          cx={CX}
          cy={CY}
          r={RADIUS}
          fill="none"
          stroke={BRAND_COLORS.yellow}
          strokeWidth={10}
          opacity={intro * 0.32}
        />

        {/* Direction chevrons sitting between the stages. */}
        {[-45, 45, 135, 225].map((angle) => {
          const point = toPoint(angle, RADIUS);
          return (
            <path
              key={angle}
              d="M -13 -11 L 0 0 L -13 11"
              fill="none"
              stroke={BRAND_COLORS.yellow}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={intro * 0.7}
              // Rotated onto the clockwise tangent at this point on the ring.
              transform={`translate(${point.x} ${point.y}) rotate(${angle + 90})`}
            />
          );
        })}

        {/* The sweep travelling the loop. Rotated rather than redrawn, so it
            carries straight through the seam at the top on the second lap. */}
        <g
          // Offset by the sweep's own length so its LEADING edge sits at headDeg,
          // which is the angle the stage-activation maths below keys off.
          transform={`rotate(${headDeg - 90 - SWEEP_FRACTION * 360} ${CX} ${CY})`}
        >
          <circle
            cx={CX}
            cy={CY}
            r={RADIUS}
            fill="none"
            stroke="url(#cycleSweep)"
            strokeWidth={12}
            strokeLinecap="round"
            opacity={intro}
            // One dash, one full-circumference gap: a single arc that the
            // rotation above carries around the ring.
            strokeDasharray={`${CIRCUMFERENCE * SWEEP_FRACTION} ${CIRCUMFERENCE}`}
          />
        </g>

        {STAGES.map((stage, index) => {
          const angle = -90 + index * 90;
          const point = toPoint(angle, RADIUS);

          // How far past this stage the head has travelled on the current lap.
          const since = (((headDeg - index * 90) % 360) + 360) % 360;
          // Peaks as the head arrives, decaying over the following quarter turn.
          const active = laps <= 0 ? 0 : interpolate(since, [0, 90], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const nodeRadius = 30 + active * 10;

          return (
            <g key={stage.label} opacity={intro}>
              <circle
                cx={point.x}
                cy={point.y}
                r={nodeRadius}
                fill={stage.color}
                opacity={0.35 + active * 0.65}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={nodeRadius}
                fill="none"
                stroke={stage.color}
                strokeWidth={4}
                opacity={0.5 + active * 0.5}
              />
              <text
                x={point.x + stage.dx}
                y={point.y + stage.dy}
                textAnchor={stage.anchor}
                dominantBaseline="middle"
                style={{
                  fontFamily: BRAND_FONTS.primary,
                  fontSize: 52,
                  fontWeight: 600,
                  fill: stage.color,
                  opacity: 0.6 + active * 0.4,
                  textShadow: TEXT_SHADOW,
                }}
              >
                {stage.label}
              </text>
            </g>
          );
        })}

        <text
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: BRAND_FONTS.secondary,
            fontSize: 44,
            letterSpacing: 8,
            fill: BRAND_COLORS.light,
            opacity: intro * 0.85,
            textShadow: TEXT_SHADOW,
          }}
        >
          THE CYCLE
        </text>
      </svg>
    </AbsoluteFill>
  );
};
