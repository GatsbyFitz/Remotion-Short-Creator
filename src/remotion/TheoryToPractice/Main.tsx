import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

// Both padded/sized to the same length so each index flips old char -> new char.
const FROM_WORD = " Theory ";
const TO_WORD = "Practice";

const FLIP_START = 20;
const FLIP_STEP = 6;
const CARD_WIDTH = 110;
const CARD_HEIGHT = 150;
const CARD_GAP = 12;
const FONT_SIZE = 84;

const FlipCard: React.FC<{ from: string; to: string; delay: number }> = ({
  from,
  to,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    fps,
    frame: frame - delay,
    config: { damping: 18, mass: 0.9, stiffness: 110 },
  });
  const angle = interpolate(progress, [0, 1], [0, 180], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const faceStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: BRAND_FONTS.primary,
    fontSize: FONT_SIZE,
    fontWeight: 700,
    borderRadius: 16,
    backfaceVisibility: "hidden",
    boxShadow: "0 12px 28px rgba(0, 0, 0, 0.3)",
  };

  return (
    <div
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        perspective: 900,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `rotateX(${angle}deg)`,
        }}
      >
        <div
          style={{
            ...faceStyle,
            color: BRAND_COLORS.black,
            border: from.trim() ? `6px solid ${BRAND_COLORS.black}` : "none",
          }}
        >
          {from.trim() ? from : ""}
        </div>
        <div
          style={{
            ...faceStyle,
            color: BRAND_COLORS.pink,
            border: `6px solid ${BRAND_COLORS.pink}`,
            transform: "rotateX(180deg)",
          }}
        >
          {to}
        </div>
      </div>
    </div>
  );
};

export const TheoryToPractice: React.FC = () => {



  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: CARD_GAP,
        }}
      >
        {FROM_WORD.split("").map((char, index) => (
          <FlipCard
            key={index}
            from={char}
            to={TO_WORD[index]}
            delay={FLIP_START + index * FLIP_STEP}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const calculateMetadata = async () => {
  return {
    fps: 30,
    durationInFrames: 150,
    width: 1920,
    height: 1080,
    defaultCodec: "prores" as const,
    defaultVideoImageFormat: "png" as const,
    defaultPixelFormat: "yuva444p10le" as const,
    defaultProResProfile: "4444" as const,
  } as const;
};
