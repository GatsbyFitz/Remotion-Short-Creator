import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

const BASE_FPS = 30;
const DURATION_IN_FRAMES = 150; // 5s @ 30fps

// Momentum arrives fast and overshoots; meaning takes its time. The two words
// are animated against each other on purpose — the motion is the argument.
const MOMENTUM_ENTER_FRAMES = 26;
const NEQ_FRAME = 38;
const MEANING_START_FRAME = 56;
const MEANING_ENTER_FRAMES = 46;

const GHOST_COUNT = 3;

// Sits over arbitrary footage, so every mark carries its own contrast.
const TEXT_SHADOW = "0 4px 20px rgba(0, 0, 0, 0.55)";

const WORD_STYLE: React.CSSProperties = {
  fontFamily: BRAND_FONTS.primary,
  fontSize: 116,
  fontWeight: 600,
  lineHeight: 1,
  letterSpacing: 1,
  textShadow: TEXT_SHADOW,
  whiteSpace: "nowrap",
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

export const MomentumMeaning: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fast in, hard decelerate.
  const enter = interpolate(frame, [0, MOMENTUM_ENTER_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const momentumX = interpolate(enter, [0, 1], [-560, 0]);
  // Drops to 0 as it lands — drives the speed trails behind the word.
  const speed = 1 - enter;

  // Momentum never fully settles: a permanent low-level restlessness, so it
  // reads as motion that hasn't actually arrived anywhere.
  const jitterX = Math.sin(frame * 0.9) * 2.6;
  const jitterY = Math.cos(frame * 1.3) * 1.6;

  const neq = spring({
    fps,
    frame: frame - NEQ_FRAME,
    config: { damping: 200, stiffness: 120, mass: 0.8 },
  });
  const neqOpacity = interpolate(neq, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const neqScale = interpolate(neq, [0, 1], [1.6, 1], { extrapolateRight: "clamp" });

  // Slow, even, and then completely still. No jitter, no overshoot.
  const meaning = interpolate(
    frame,
    [MEANING_START_FRAME, MEANING_START_FRAME + MEANING_ENTER_FRAMES],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );
  const meaningRise = interpolate(meaning, [0, 1], [16, 0]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        gap: 52,
      }}
    >
      {/* Momentum, with speed trails that die off as it lands. */}
      <div style={{ position: "relative" }}>
        {Array.from({ length: GHOST_COUNT }).map((_, index) => (
          <span
            key={index}
            style={{
              ...WORD_STYLE,
              position: "absolute",
              top: 0,
              left: 0,
              color: BRAND_COLORS.yellow,
              opacity: (speed * 0.3) / (index + 1),
              transform: `translateX(${momentumX - (index + 1) * 64 * speed}px)`,
            }}
          >
            Momentum
          </span>
        ))}
        <span
          style={{
            ...WORD_STYLE,
            display: "block",
            color: BRAND_COLORS.yellow,
            opacity: interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translate(${momentumX + jitterX}px, ${jitterY}px)`,
          }}
        >
          Momentum
        </span>
      </div>

      <span
        style={{
          ...WORD_STYLE,
          fontSize: 96,
          color: BRAND_COLORS.pink,
          opacity: neqOpacity,
          transform: `scale(${neqScale})`,
        }}
      >
        ≠
      </span>

      <span
        style={{
          ...WORD_STYLE,
          color: BRAND_COLORS.light,
          opacity: meaning,
          transform: `translateY(${meaningRise}px)`,
        }}
      >
        Meaning
      </span>
    </AbsoluteFill>
  );
};
