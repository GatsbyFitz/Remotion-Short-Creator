import { fontFamily, loadFont } from "@remotion/google-fonts/Inter";
import {
  AbsoluteFill,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { z } from "zod";
import { BRAND_COLORS } from "../theme";

loadFont("normal", {
  subsets: ["latin"],
  weights: ["400", "700"],
});

const RunningChannelProps = z.object({
  channelName: z.string(),
  subtitle: z.string().optional(),
});

export const RunningChannel = ({
  channelName,
  subtitle = "Running Motivation",
}: z.infer<typeof RunningChannelProps>) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title animation
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const titleScale = spring({
    fps,
    frame,
    config: {
      damping: 100,
      stiffness: 200,
    },
  });

  // Subtitle animation
  const subtitleOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleY = interpolate(frame, [20, 50], [50, 0], {
    extrapolateRight: "clamp",
  });

  // Animated gradient background
  const gradientRotation = interpolate(frame, [0, 150], [0, 360], {
    extrapolateRight: "extend",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${gradientRotation}deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Running track lines animation */}
      <Sequence>
        <AbsoluteFill>
          {[...Array(5)].map((_, i) => {
            const lineOffset = interpolate(
              frame,
              [0, 150],
              [i * 200, i * 200 + 1920],
              {
                extrapolateRight: "extend",
              }
            );
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${lineOffset % 1920}px`,
                  top: "50%",
                  width: "100px",
                  height: "4px",
                  backgroundColor: BRAND_COLORS.trackLine,
                  transform: "translateY(-50%)",
                }}
              />
            );
          })}
        </AbsoluteFill>
      </Sequence>

      {/* Content */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        <div
          style={{
            textAlign: "center",
            padding: "40px",
          }}
        >
          <h1
            style={{
              fontSize: "120px",
              fontWeight: 700,
              fontFamily,
              color: BRAND_COLORS.textPrimary,
              margin: 0,
              opacity: titleOpacity,
              transform: `scale(${titleScale})`,
              textShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
            }}
          >
            {channelName}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: "40px",
                fontWeight: 400,
                fontFamily,
                color: BRAND_COLORS.textSecondary,
                margin: "20px 0 0 0",
                opacity: subtitleOpacity,
                transform: `translateY(${subtitleY}px)`,
                textShadow: "0 5px 20px rgba(0, 0, 0, 0.2)",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export type { RunningChannelProps };
