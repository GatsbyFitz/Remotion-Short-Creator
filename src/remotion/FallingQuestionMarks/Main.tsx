import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

type QuestionMark = {
  x: number;
  startY: number;
  size: number;
  delay: number;
  drift: number;
  rotation: number;
  color: string;
  opacity: number;
};

const seededValue = (seed: number) => {
  const value = Math.sin(seed * 999) * 10000;
  return value - Math.floor(value);
};

const QUESTION_MARKS: QuestionMark[] = [
  { x: 4, startY: -220, size: 104, delay: 0, drift: 26, rotation: -8, color: BRAND_COLORS.pink, opacity: 1 },
  { x: 9, startY: -160, size: 72, delay: 5, drift: -18, rotation: 10, color: BRAND_COLORS.yellow, opacity: 0.92 },
  { x: 13, startY: -300, size: 154, delay: 10, drift: 30, rotation: 6, color: BRAND_COLORS.pink, opacity: 0.82 },
  { x: 18, startY: -190, size: 86, delay: 15, drift: -24, rotation: -12, color: BRAND_COLORS.yellow, opacity: 0.85 },
  { x: 24, startY: -260, size: 126, delay: 20, drift: 20, rotation: 14, color: BRAND_COLORS.pink, opacity: 0.96 },
  { x: 29, startY: -140, size: 68, delay: 25, drift: -28, rotation: -6, color: BRAND_COLORS.yellow, opacity: 0.78 },
  { x: 34, startY: -240, size: 146, delay: 30, drift: 22, rotation: 4, color: BRAND_COLORS.pink, opacity: 0.9 },
  { x: 39, startY: -180, size: 90, delay: 35, drift: -16, rotation: 18, color: BRAND_COLORS.yellow, opacity: 0.8 },
  { x: 44, startY: -320, size: 168, delay: 40, drift: 34, rotation: -10, color: BRAND_COLORS.pink, opacity: 0.74 },
  { x: 49, startY: -210, size: 96, delay: 45, drift: -20, rotation: 8, color: BRAND_COLORS.yellow, opacity: 0.88 },
  { x: 54, startY: -280, size: 120, delay: 50, drift: 18, rotation: 12, color: BRAND_COLORS.pink, opacity: 0.86 },
  { x: 59, startY: -150, size: 76, delay: 55, drift: -14, rotation: -9, color: BRAND_COLORS.yellow, opacity: 0.84 },
  { x: 64, startY: -230, size: 158, delay: 60, drift: 28, rotation: 7, color: BRAND_COLORS.pink, opacity: 0.76 },
  { x: 69, startY: -170, size: 84, delay: 65, drift: -22, rotation: 16, color: BRAND_COLORS.yellow, opacity: 0.9 },
  { x: 74, startY: -310, size: 136, delay: 70, drift: 24, rotation: -11, color: BRAND_COLORS.pink, opacity: 0.83 },
  { x: 79, startY: -200, size: 92, delay: 75, drift: -18, rotation: 6, color: BRAND_COLORS.yellow, opacity: 0.87 },
  { x: 84, startY: -260, size: 164, delay: 80, drift: 30, rotation: -4, color: BRAND_COLORS.pink, opacity: 0.7 },
  { x: 89, startY: -130, size: 70, delay: 85, drift: -26, rotation: 13, color: BRAND_COLORS.yellow, opacity: 0.82 },
  { x: 94, startY: -240, size: 144, delay: 90, drift: 20, rotation: -7, color: BRAND_COLORS.pink, opacity: 0.88 },
  { x: 97, startY: -180, size: 80, delay: 95, drift: -12, rotation: 9, color: BRAND_COLORS.yellow, opacity: 0.9 },
];

export const FallingQuestionMarks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const width = 1920;
  const height = 1080;
  const fontSizeScale = 1;

  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>

        <rect x="0" y="0" width={width} height={height} fill="transparent" />
        <rect x="0" y="0" width={width} height={height} fill="url(#questionMarkWash)" />

        {QUESTION_MARKS.map((mark, index) => {
          const localFrame = Math.max(0, frame - mark.delay);
          const randomColor = seededValue(index * 7 + 4) > 0.5 ? BRAND_COLORS.pink : BRAND_COLORS.yellow;
          const scatterSeed = seededValue(index * 11 + 7);
          const scatterX = scatterSeed * width;
          const scatterOffset = (seededValue(index * 13 + 9) - 0.5) * 140;
          const randomX = seededValue(index * 2 + 1);
          const randomDrift = seededValue(index * 3 + 2);
          const randomJiggle = seededValue(index * 5 + 3);
          const randomJiggleSpeed = 0.08 + randomJiggle * 0.08;
          const randomJigglePhase = randomJiggle * Math.PI * 2;
          const randomJiggleAmount = 2 + randomDrift * 4;
          const slowFall = interpolate(localFrame, [0, fps * 10], [0, 1], {
            easing: Easing.out(Easing.cubic),
            extrapolateRight: "clamp",
          });

        const driftProgress = interpolate(localFrame, [0, fps * 5], [0, 1], {
          easing: Easing.out(Easing.cubic),
          extrapolateRight: "clamp",
        });

          const translateY = interpolate(slowFall, [0, 1], [mark.startY, height + 340], {
          extrapolateRight: "clamp",
        });

          const translateX = interpolate(driftProgress, [0, 1], [0, mark.drift + randomX * 12 - 6], {
          extrapolateRight: "clamp",
        });

          const rotate = interpolate(slowFall, [0, 1], [mark.rotation, mark.rotation + 18], {
          extrapolateRight: "clamp",
        });

          const jiggleX = Math.sin((localFrame + randomJigglePhase) * randomJiggleSpeed) * randomJiggleAmount;
          const jiggleY = Math.cos((localFrame + randomJigglePhase) * randomJiggleSpeed * 1.2) * (randomJiggleAmount * 0.7);
          const jiggleRotate = Math.sin((localFrame + randomJigglePhase) * randomJiggleSpeed * 1.5) * (1.5 + randomDrift * 2.5);

        const fadeIn = interpolate(localFrame, [0, 12], [0, 1], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
        });

          const fadeOut = interpolate(localFrame, [fps * 8, fps * 10], [1, 0], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
        });

          const opacity = mark.opacity * fadeIn * fadeOut;
          const baseX = scatterX + scatterOffset;

        return (
          <text
            key={index}
            x={baseX}
            y={0}
            transform={`translate(${translateX + jiggleX} ${translateY + jiggleY}) rotate(${rotate + jiggleRotate} ${baseX} 0)`}
            opacity={opacity}
            textAnchor="middle"
            dominantBaseline="hanging"
            fontFamily={BRAND_FONTS.primary}
            fontSize={mark.size * fontSizeScale}
            fill={randomColor}
            stroke={BRAND_COLORS.black}
            strokeWidth={2}
            paintOrder="stroke fill"
            filter={`drop-shadow(0 0 24px ${randomColor}55)`}
          >
            ?
          </text>
        );
        })}

        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="rgba(255, 255, 255, 0)"
          opacity={0.55}
        />

        <text
          x="60"
          y="96"
          fontFamily={BRAND_FONTS.secondary}
          fontSize={26}
          letterSpacing={6}
          fill={BRAND_COLORS.textLight}
          opacity={0.75}
        >
          Unknown
        </text>

        <text
          x={width - 60}
          y={height - 72}
          textAnchor="end"
          fontFamily={BRAND_FONTS.tertiary}
          fontSize={42}
          fill={BRAND_COLORS.yellow}
          opacity={0.9}
        >
          ?
        </text>
      </svg>
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
