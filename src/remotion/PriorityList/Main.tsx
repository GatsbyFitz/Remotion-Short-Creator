import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BRAND_FONTS } from "../theme";

const PRIORITIES = [
  "Training Volume",
  "Nutrition",
  "Hydration",
  "Sleep & Recovery",
  "Strength Training",
  "Mobility & Stretching",
  "Mental Resilience",
  "Race Strategy",
  "Pacing",
  "Gear Selection",
  "Footwear Fit",
  "Sock Choice",
  "Weather Prep",
  "Heat Acclimatization",
  "Electrolyte Balance",
  "Course Knowledge",
  "Elevation Training",
  "Injury Prevention",
  "Crew Communication",
  "Fueling Strategy",
  "Race Day Nutrition",
  "Navigation Skills",
  "Chafing Prevention",
  "Skin Care",
  "Trekking Poles",
  "Pack Fit",
  "First Aid Supplies",
  "Toenail Care",
  "Foot Hygiene",
  "Blister Management",
] as const;

const DURATION_IN_FRAMES = 150; // 5s @ 30fps
const FADE_IN_FRAMES = 10;
const HOLD_FRAMES = 30;
const TAIL_FRAMES = 10;

const SCAN_END = DURATION_IN_FRAMES - HOLD_FRAMES - TAIL_FRAMES;

const ROW_HEIGHT = 100;
const VISIBLE_ROWS = 5;
const VIEWPORT_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

const BLACK_RGB = [0, 0, 0];
const YELLOW_RGB = [0xe1, 0xff, 0x62];

export const PriorityList: React.FC = () => {
  const frame = useCurrentFrame();

  const containerOpacity = interpolate(frame, [0, FADE_IN_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
  });

  const rawStep = interpolate(frame, [0, SCAN_END], [0, PRIORITIES.length - 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const isOnFinal = frame >= SCAN_END;
  const finalPulse = interpolate(
    frame,
    [SCAN_END, SCAN_END + HOLD_FRAMES / 2, SCAN_END + HOLD_FRAMES],
    [1, 1.08, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const listOffset = VIEWPORT_HEIGHT / 2 - ROW_HEIGHT / 2 - rawStep * ROW_HEIGHT;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: BRAND_FONTS.primary,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 1100,
          height: VIEWPORT_HEIGHT,
          overflow: "hidden",
          opacity: containerOpacity,
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)",
        }}
      >
        <div style={{ position: "absolute", top: listOffset, left: 0, right: 0 }}>
          {PRIORITIES.map((label, index) => {
            const distance = index - rawStep;
            const proximity = Math.max(0, 1 - Math.abs(distance));
            const isFinalRow = index === PRIORITIES.length - 1;

            const r = Math.round(interpolate(proximity, [0, 1], [BLACK_RGB[0], YELLOW_RGB[0]]));
            const g = Math.round(interpolate(proximity, [0, 1], [BLACK_RGB[1], YELLOW_RGB[1]]));
            const b = Math.round(interpolate(proximity, [0, 1], [BLACK_RGB[2], YELLOW_RGB[2]]));

            let scale = 1 + 0.14 * proximity;
            if (isFinalRow && isOnFinal) {
              scale *= finalPulse;
            }

            return (
              <div
                key={label}
                style={{
                  height: ROW_HEIGHT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: BRAND_FONTS.secondary,
                  fontSize: 46,
                  fontWeight: proximity > 0.6 ? 700 : 500,
                  color: `rgb(${r}, ${g}, ${b})`,
                  transform: `scale(${scale})`,
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const calculateMetadata = async () => {
  return {
    fps: 30,
    durationInFrames: DURATION_IN_FRAMES,
    width: 1920,
    height: 1080,
    defaultCodec: "prores" as const,
    defaultVideoImageFormat: "png" as const,
    defaultPixelFormat: "yuva444p10le" as const,
    defaultProResProfile: "4444" as const,
  } as const;
};
