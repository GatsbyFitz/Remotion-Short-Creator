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

const INTRO_FRAMES = 20;
// Each question gets less time than the one before it. The pattern becomes
// obvious, so the later ones don't need as long to read — and the quickening
// is the trap closing.
const SLOT_FRAMES = [50, 46, 42, 38, 34] as const;
const OUTRO_FRAMES = 30;

const DURATION_IN_FRAMES =
  INTRO_FRAMES + SLOT_FRAMES.reduce((sum, n) => sum + n, 0) + OUTRO_FRAMES;

// The question is asked in full above; the band carries the answer, kept short
// because the silo is too narrow to hold a sentence. That narrowness is the
// point, so the answer gives way, not the walls.
//
// Five different questions about five different parts of a life, and an ultra
// runner answers every one of them with the same thing.
const QUESTIONS = [
  { question: "This is who I am?", label: "Runner" },
  { question: "This is what I do?", label: "Run" },
  { question: "This is what makes me interesting?", label: "Ultras" },
  { question: "This is where I get my confidence from?", label: "Finishing" },
  { question: "This is how I regulate my emotions?", label: "Miles" },
] as const;

const SILO_LEFT = 810;
const SILO_RIGHT = 1110;
const SILO_TOP = 205;
const SILO_FLOOR = 930;
const WALL_WIDTH = 8;

const BAND_HEIGHT = 130;
const BAND_GAP = 4;
const BAND_INSET = WALL_WIDTH / 2 + 4;

const TEXT_SHADOW = "0 4px 20px rgba(0, 0, 0, 0.55)";

// Filled from the floor up, so the newest answer sits on top of every earlier one.
const bandTop = (index: number) =>
  SILO_FLOOR - WALL_WIDTH / 2 - BAND_HEIGHT - index * (BAND_HEIGHT + BAND_GAP);

const slotStart = (index: number) =>
  INTRO_FRAMES + SLOT_FRAMES.slice(0, index).reduce((sum, n) => sum + n, 0);

const LAST_LANDING_FRAME = slotStart(QUESTIONS.length - 1) + 24;

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

export const IdentitySilo: React.FC = () => {
  const frame = useCurrentFrame();

  const intro = interpolate(frame, [0, INTRO_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Once it's full the container itself becomes the problem, so the walls take
  // on the colour this set uses for the failure state.
  const wallColor = interpolateColors(
    interpolate(frame, [LAST_LANDING_FRAME + 6, LAST_LANDING_FRAME + 26], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    [0, 1],
    [BRAND_COLORS.light, BRAND_COLORS.pink],
  );

  return (
    <AbsoluteFill>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        role="img"
        aria-label="Five questions about different parts of a life, each poured into the same narrow silo"
        style={{ filter: "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5))" }}
      >
        {QUESTIONS.map((entry, index) => {
          const start = slotStart(index);
          const length = SLOT_FRAMES[index];

          const questionOpacity =
            interpolate(frame, [start, start + 9], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }) *
            interpolate(frame, [start + length - 12, start + length - 2], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

          return (
            <text
              key={entry.question}
              x={960}
              y={150}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontFamily: BRAND_FONTS.primary,
                fontSize: 46,
                fontWeight: 600,
                fill: BRAND_COLORS.light,
                opacity: questionOpacity,
                textShadow: TEXT_SHADOW,
              }}
            >
              {entry.question}
            </text>
          );
        })}

        {/* Bands are drawn before the walls so the walls read as in front of
            them, the way the inside of a container would. */}
        {QUESTIONS.map((entry, index) => {
          const start = slotStart(index);
          const resting = bandTop(index);

          const drop = interpolate(frame, [start + 14, start + 24], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.in(Easing.quad),
          });
          const rebound = interpolate(
            frame,
            [start + 24, start + 27, start + 30],
            [0, -9, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );

          // Falls in from above the open top.
          const y = interpolate(drop, [0, 1], [SILO_TOP - BAND_HEIGHT - 160, resting]) + rebound;

          return (
            <g key={entry.label} opacity={drop > 0 ? 1 : 0}>
              <rect
                x={SILO_LEFT + BAND_INSET}
                y={y}
                width={SILO_RIGHT - SILO_LEFT - BAND_INSET * 2}
                height={BAND_HEIGHT}
                rx={6}
                fill={BRAND_COLORS.yellow}
              />
              <text
                x={(SILO_LEFT + SILO_RIGHT) / 2}
                y={y + BAND_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  fontFamily: BRAND_FONTS.primary,
                  fontSize: 34,
                  fontWeight: 600,
                  fill: BRAND_COLORS.black,
                }}
              >
                {entry.label}
              </text>
            </g>
          );
        })}

        {/* Open at the top, hard-edged at the sides. Nothing widens. */}
        <path
          d={
            `M ${SILO_LEFT - 20} ${SILO_TOP} L ${SILO_LEFT} ${SILO_TOP} ` +
            `L ${SILO_LEFT} ${SILO_FLOOR} L ${SILO_RIGHT} ${SILO_FLOOR} ` +
            `L ${SILO_RIGHT} ${SILO_TOP} L ${SILO_RIGHT + 20} ${SILO_TOP}`
          }
          fill="none"
          stroke={wallColor}
          strokeWidth={WALL_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={intro}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - intro}
        />
      </svg>
    </AbsoluteFill>
  );
};
