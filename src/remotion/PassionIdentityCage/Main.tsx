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

const FIRST_WORD_FRAME = 10;
const WORD_STAGGER = 22;

// The cage outline closes in once the last word has settled.
const CAGE_START_FRAME = FIRST_WORD_FRAME + WORD_STAGGER * 2 + 14;
const CAGE_DRAW_FRAMES = 20;

// Bars drop into the frame once it has closed, so the last word is literally
// caged — the same motif as the PrisonBars overlay.
const CAGE_BAR_COUNT = 5;
const CAGE_BAR_START_FRAME = CAGE_START_FRAME + CAGE_DRAW_FRAMES - 4;
const CAGE_BAR_STAGGER = 4;
const CAGE_BAR_FALL_FRAMES = 9;

// The run darkens as it goes: an open, bright start narrowing to a hard finish.
const STAGES = [
  { label: "Passion", color: BRAND_COLORS.yellow },
  { label: "Identity", color: BRAND_COLORS.pink },
  { label: "Cage", color: BRAND_COLORS.light },
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

export const PassionIdentityCage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Draws in around the final word, tightening from loose to snug.
  const cageProgress = interpolate(
    frame,
    [CAGE_START_FRAME, CAGE_START_FRAME + CAGE_DRAW_FRAMES],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        gap: 40,
      }}
    >
      {STAGES.map((stage, index) => {
        const wordProgress = spring({
          fps,
          frame: frame - FIRST_WORD_FRAME - index * WORD_STAGGER,
          config: { damping: 200, stiffness: 120, mass: 0.8 },
        });
        const wordOpacity = interpolate(wordProgress, [0, 1], [0, 1], {
          extrapolateRight: "clamp",
        });
        const wordRise = interpolate(wordProgress, [0, 1], [20, 0], {
          extrapolateRight: "clamp",
        });

        // The arrow into this stage fades in just ahead of the word it leads to.
        const arrowOpacity = interpolate(
          frame,
          [
            FIRST_WORD_FRAME + index * WORD_STAGGER - 10,
            FIRST_WORD_FRAME + index * WORD_STAGGER,
          ],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        const isCage = index === STAGES.length - 1;

        return (
          <React.Fragment key={stage.label}>
            {index > 0 ? (
              <span
                style={{
                  fontFamily: BRAND_FONTS.secondary,
                  fontSize: 72,
                  lineHeight: 1,
                  color: BRAND_COLORS.light,
                  textShadow: TEXT_SHADOW,
                  opacity: arrowOpacity,
                }}
              >
                →
              </span>
            ) : null}

            <div
              style={{
                position: "relative",
                padding: "18px 26px",
                opacity: wordOpacity,
                transform: `translateY(${wordRise}px)`,
              }}
            >
              <span
                style={{
                  fontFamily: BRAND_FONTS.primary,
                  fontSize: 104,
                  fontWeight: 600,
                  lineHeight: 1,
                  letterSpacing: 1,
                  color: stage.color,
                  textShadow: TEXT_SHADOW,
                }}
              >
                {stage.label}
              </span>

              {isCage ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    border: `4px solid ${BRAND_COLORS.light}`,
                    borderRadius: 6,
                    boxShadow: "0 6px 24px rgba(0, 0, 0, 0.45)",
                    opacity: cageProgress,
                    overflow: "hidden",
                    // Closes in on the word rather than simply appearing.
                    transform: `scale(${interpolate(cageProgress, [0, 1], [1.35, 1])})`,
                  }}
                >
                  {Array.from({ length: CAGE_BAR_COUNT }).map((_, barIndex) => {
                    const barStart = CAGE_BAR_START_FRAME + barIndex * CAGE_BAR_STAGGER;
                    const barDrop = interpolate(
                      frame,
                      [barStart, barStart + CAGE_BAR_FALL_FRAMES],
                      [-100, 0],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                        easing: Easing.in(Easing.quad),
                      },
                    );

                    return (
                      <div
                        key={barIndex}
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          // Evenly spaced across the box, inset from the frame.
                          left: `${((barIndex + 1) / (CAGE_BAR_COUNT + 1)) * 100}%`,
                          width: 6,
                          marginLeft: -3,
                          backgroundColor: BRAND_COLORS.light,
                          // The word behind is also white, so without an edge the
                          // bars vanish into the letterforms.
                          boxShadow: "0 0 7px rgba(0, 0, 0, 0.75)",
                          opacity: 0.95,
                          transform: `translateY(${barDrop}%)`,
                        }}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
