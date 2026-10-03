import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

const BASE_FPS = 30;
const DURATION_IN_FRAMES = 235;

const BASELINE_Y = 720;
const LINE_START_X = 140;
const LINE_END_X = 1780;

const IGNORE_DRAW_START = 10;
const IGNORE_DRAW_END = 140;
const HANDOVER_FRAME = 150;
const LISTEN_DRAW_START = 162;
const LISTEN_DRAW_END = 198;

// Each signal the body sends is louder than the last one that went unanswered.
// The final spike isn't a new message — it's the same one, at the only volume
// left.
const SIGNALS = [
  { x: 360, amplitude: 34, label: "Tightness" },
  { x: 620, amplitude: 72, label: "Niggle" },
  { x: 880, amplitude: 130, label: "Soreness" },
  { x: 1140, amplitude: 210, label: "Sharp pain" },
  { x: 1440, amplitude: 400, label: "Injury" },
] as const;

// Caught at the whisper, the same signal never has to escalate.
const HEEDED_SIGNAL = { x: 360, amplitude: 34, label: "Tightness" } as const;

const PULSE_HALF_WIDTH = 40;

const buildTrace = (signals: ReadonlyArray<{ x: number; amplitude: number }>) => {
  let d = `M ${LINE_START_X} ${BASELINE_Y}`;
  for (const signal of signals) {
    d += ` L ${signal.x - PULSE_HALF_WIDTH} ${BASELINE_Y}`;
    d += ` L ${signal.x} ${BASELINE_Y - signal.amplitude}`;
    d += ` L ${signal.x + PULSE_HALF_WIDTH} ${BASELINE_Y}`;
  }
  return `${d} L ${LINE_END_X} ${BASELINE_Y}`;
};

// Where along the trace a given x sits. The trace is overwhelmingly horizontal,
// so x maps closely enough to path length to time the labels off.
const traceFraction = (x: number) => (x - LINE_START_X) / (LINE_END_X - LINE_START_X);

const TEXT_SHADOW = "0 4px 20px rgba(0, 0, 0, 0.55)";
const GREEN_TEXT_SHADOW =
  "0 2px 8px rgba(0, 0, 0, 0.9), 0 4px 20px rgba(0, 0, 0, 0.6)";

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

export const ListenToYourBody: React.FC = () => {
  const frame = useCurrentFrame();

  const ignoreDraw = interpolate(frame, [IGNORE_DRAW_START, IGNORE_DRAW_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The ignored trace clears so the same opening signal can play again.
  const ignoreOpacity = interpolate(frame, [HANDOVER_FRAME, HANDOVER_FRAME + 16], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const listenDraw = interpolate(frame, [LISTEN_DRAW_START, LISTEN_DRAW_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const listenOpacity = interpolate(frame, [LISTEN_DRAW_START - 6, LISTEN_DRAW_START + 6], [0, 1], {
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
        aria-label="A body signal escalating while ignored, then the same signal answered at the first whisper"
        style={{ filter: "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5))" }}
      >
        <defs>
          {/* Quiet and green at the left, screaming and pink by the right. */}
          <linearGradient
            id="signalEscalation"
            gradientUnits="userSpaceOnUse"
            x1={LINE_START_X}
            y1={0}
            x2={LINE_END_X}
            y2={0}
          >
            <stop offset="0%" stopColor={BRAND_COLORS.yellow} />
            <stop offset="45%" stopColor={BRAND_COLORS.yellow} />
            <stop offset="100%" stopColor={BRAND_COLORS.pink} />
          </linearGradient>
        </defs>

        <g opacity={ignoreOpacity}>
          <path
            d={buildTrace(SIGNALS)}
            fill="none"
            stroke="url(#signalEscalation)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - ignoreDraw}
          />

          {SIGNALS.map((signal, index) => {
            const fraction = traceFraction(signal.x);
            const reveal = interpolate(ignoreDraw, [fraction - 0.01, fraction + 0.035], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const isFinal = index === SIGNALS.length - 1;

            return (
              <g key={signal.label} opacity={reveal}>
                <text
                  x={signal.x}
                  y={BASELINE_Y - signal.amplitude - 30}
                  textAnchor="middle"
                  style={{
                    fontFamily: BRAND_FONTS.primary,
                    fontSize: isFinal ? 60 : 34,
                    fontWeight: 600,
                    fill: isFinal ? BRAND_COLORS.pink : BRAND_COLORS.light,
                    textShadow: TEXT_SHADOW,
                  }}
                >
                  {isFinal ? signal.label.toUpperCase() : signal.label}
                </text>

                {/* Every signal before the last one got the same answer. */}
                {isFinal ? null : (
                  <text
                    x={signal.x}
                    y={BASELINE_Y + 52}
                    textAnchor="middle"
                    style={{
                      fontFamily: BRAND_FONTS.secondary,
                      fontSize: 26,
                      letterSpacing: 3,
                      fill: BRAND_COLORS.pink,
                      textShadow: TEXT_SHADOW,
                    }}
                  >
                    IGNORED
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* The same opening signal, answered this time. */}
        <g opacity={listenOpacity}>
          <path
            d={buildTrace([HEEDED_SIGNAL])}
            fill="none"
            stroke={BRAND_COLORS.yellow}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - listenDraw}
          />

          <g
            opacity={interpolate(listenDraw, [traceFraction(HEEDED_SIGNAL.x), 0.4], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}
          >
            <text
              x={HEEDED_SIGNAL.x}
              y={BASELINE_Y - HEEDED_SIGNAL.amplitude - 30}
              textAnchor="middle"
              style={{
                fontFamily: BRAND_FONTS.primary,
                fontSize: 34,
                fontWeight: 600,
                fill: BRAND_COLORS.light,
                textShadow: TEXT_SHADOW,
              }}
            >
              {HEEDED_SIGNAL.label}
            </text>
            <text
              x={HEEDED_SIGNAL.x}
              y={BASELINE_Y + 52}
              textAnchor="middle"
              style={{
                fontFamily: BRAND_FONTS.secondary,
                fontSize: 26,
                letterSpacing: 3,
                fill: BRAND_COLORS.yellow,
                textShadow: GREEN_TEXT_SHADOW,
              }}
            >
              HEARD
            </text>
          </g>

          {/* Nothing further to report. */}
          <text
            x={1180}
            y={BASELINE_Y - 54}
            textAnchor="middle"
            style={{
              fontFamily: BRAND_FONTS.primary,
              fontSize: 40,
              fontWeight: 600,
              fill: BRAND_COLORS.yellow,
              opacity: interpolate(frame, [LISTEN_DRAW_END - 6, LISTEN_DRAW_END + 12], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              textShadow: TEXT_SHADOW,
            }}
          >
            no injury
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
