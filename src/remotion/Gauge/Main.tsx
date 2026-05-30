import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

export type PushUpGaugeProps = {
  count?: number;
  topLabel?: string;
  bottomLabel?: string;
};

export const GaugeSchema = z.object({
  count: z.number().int().min(0),
  topLabel: z.string(),
  bottomLabel: z.string(),
});

export const Gauge: React.FC<PushUpGaugeProps> = ({
  count = 100,
  topLabel = "PUSH UPS",
  bottomLabel = "IN A ROW",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const value = Math.round(
    interpolate(frame, [0, 4 * fps], [0, count], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    }),
  );

  const progress = interpolate(frame, [0, 4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const radius = 255;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <AbsoluteFill className="flex items-center justify-center text-white" style={{ backgroundColor: "transparent" }}>
      <div className="relative flex w-full max-w-4xl items-center justify-center px-10 text-center drop-shadow-[0_14px_28px_rgba(0,0,0,0.55)]">
        <svg width="760" height="760" viewBox="0 0 760 760" role="img" aria-label="Circular progress gauge">
          <circle
            cx="380"
            cy="380"
            r={radius}
            fill="none"
            stroke={BRAND_COLORS.yellow}
            strokeWidth="28"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 380 380)"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: BRAND_COLORS.yellow,
                fontFamily: BRAND_FONTS.primary,
                fontSize: 180,
                fontWeight: 900,
                letterSpacing: -4,
                lineHeight: 0.85,
                textAlign: "center",
                textShadow: "0 12px 24px rgba(0, 0, 0, 0.55)",
              }}
            >
              {value}
            </div>

            <div
              style={{
                color: BRAND_COLORS.yellow,
                fontFamily: BRAND_FONTS.secondary,
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: 4,
                lineHeight: 1,
                textAlign: "center",
                textShadow: "0 8px 16px rgba(0, 0, 0, 0.45)",
              }}
            >
              {topLabel}
            </div>
            <div
              style={{
                color: BRAND_COLORS.yellow,
                fontFamily: BRAND_FONTS.secondary,
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: 4,
                lineHeight: 1,
                textAlign: "center",
                textShadow: "0 8px 16px rgba(0, 0, 0, 0.45)",
              }}
            >
              {bottomLabel}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const calculateGaugeMetadata = async () => {
  return {
    fps: 30,
    durationInFrames: 150,
    width: 1080,
    height: 1080,
    defaultCodec: "prores",
    defaultVideoImageFormat: "png",
    defaultPixelFormat: "yuva444p10le",
    defaultProResProfile: "4444",
  };
};

