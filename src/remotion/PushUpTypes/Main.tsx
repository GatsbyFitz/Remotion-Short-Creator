import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

const HAND_DIAGRAM_WIDTH = 220;
const HAND_DIAGRAM_HEIGHT = 90;

const PUSH_UP_TYPES = [
  { label: "Normal", spread: 120 },
  { label: "Wide", spread: 170 },
  { label: "Narrow", spread: 60 },
] as const;

const HandDiagram: React.FC<{ spread: number }> = ({ spread }) => {
  const centerX = HAND_DIAGRAM_WIDTH / 2;
  const leftX = centerX - spread / 2;
  const rightX = centerX + spread / 2;

  return (
    <div
      style={{
        position: "relative",
        width: HAND_DIAGRAM_WIDTH,
        height: HAND_DIAGRAM_HEIGHT,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 10,
          right: 10,
          height: 4,
          borderRadius: 999,
          backgroundColor: BRAND_COLORS.black,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 52,
          left: leftX - 12,
          width: 24,
          height: 24,
          borderRadius: 999,
          border: `3px solid ${BRAND_COLORS.black}`,
          backgroundColor: BRAND_COLORS.light,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 52,
          left: rightX - 12,
          width: 24,
          height: 24,
          borderRadius: 999,
          border: `3px solid ${BRAND_COLORS.black}`,
          backgroundColor: BRAND_COLORS.light,
        }}
      />
    </div>
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

export const PushUpTypes: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 28], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleRise = interpolate(frame, [0, 28], [18, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        color: BRAND_COLORS.textPrimary,
        fontFamily: BRAND_FONTS.primary,
        padding: 120,
        gap: 48,
      }}
    >
      <div
        style={{
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleRise}px)`,
        }}
      >
        <div
          style={{
            fontSize: 96,
            letterSpacing: 2,
            fontWeight: 600,
          }}
        >
          Push-Up Types
        </div>
        <div
          style={{
            marginTop: 18,
            height: 6,
            width: 220,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${BRAND_COLORS.pink}, ${BRAND_COLORS.yellow})`,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 48,
          justifyContent: "center",
          alignItems: "stretch",
          width: "100%",
        }}
      >
        {PUSH_UP_TYPES.map((type, index) => {
          const cardProgress = spring({
            fps,
            frame: frame - 12 - index * 8,
            config: { damping: 200, stiffness: 120, mass: 0.8 },
          });
          const cardOpacity = interpolate(cardProgress, [0, 1], [0, 1], {
            extrapolateRight: "clamp",
          });
          const cardRise = interpolate(cardProgress, [0, 1], [24, 0], {
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={type.label}
              style={{
                flex: 1,
                border: `2px solid ${BRAND_COLORS.black}`,
                borderRadius: 32,
                padding: 48,
                minHeight: 320,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 32,
                opacity: cardOpacity,
                transform: `translateY(${cardRise}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: BRAND_FONTS.secondary,
                  fontSize: 48,
                  letterSpacing: 1,
                  color: BRAND_COLORS.textPrimary,
                }}
              >
                {type.label}
              </div>
              <HandDiagram spread={type.spread} />
              <div
                style={{
                  fontFamily: BRAND_FONTS.secondary,
                  fontSize: 22,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: BRAND_COLORS.textSecondary,
                }}
              >
                Hand Width
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
