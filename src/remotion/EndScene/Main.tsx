import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Img,
  staticFile,
} from "remotion";
import { Mail } from "lucide-react";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

export const EndScene = () => {
  const frame = useCurrentFrame();

  // Fade in animation
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Slide up animation for channel name - GATSBY
  const gatsbyOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const gatsbyY = interpolate(frame, [0, 40], [50, 0], {
    extrapolateRight: "clamp",
  });

  // Slide up animation for FITZGERALD (delayed)
  const fitzgeraldOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  const fitzgeraldY = interpolate(frame, [20, 60], [50, 0], {
    extrapolateRight: "clamp",
  });

  // Thanks for watching animation (delayed after title)
  const thanksOpacity = interpolate(frame, [40, 70], [0, 1], {
    extrapolateRight: "clamp",
  });

  const thanksY = interpolate(frame, [40, 70], [30, 0], {
    extrapolateRight: "clamp",
  });

  // Like button animation (appears first)
  const likeScale = interpolate(frame, [70, 100], [0.8, 1], {
    extrapolateRight: "clamp",
  });

  const likeOpacity = interpolate(frame, [70, 100], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Subscribe button animation (appears after like button)
  const subscribeScale = interpolate(frame, [90, 120], [0.8, 1], {
    extrapolateRight: "clamp",
  });

  const subscribeOpacity = interpolate(frame, [90, 120], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Pulse animation for Subscribe button
  const pulse = interpolate(
    frame % 60,
    [0, 30, 60],
    [1, 1.05, 1],
    {
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND_COLORS.black,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Background image */}
      <Img
        src={staticFile("Firefly_Gemini Flash_create a mountain and river vector art using these   - Black- #000000 (primary text,  202084.png")}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.2,
        }}
      />

      {/* Left space reserved for YouTube end screen overlay */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "480px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.1,
        }}
      >
        {/* Optional: Add subtle indicator for overlay area */}
        <div
          style={{
            width: "400px",
            height: "300px",
            border: `2px dashed ${BRAND_COLORS.pink}`,
            borderRadius: "12px",
          }}
        />
      </div>

      {/* Right side content */}
      <div
        style={{
          position: "absolute",
          right: "120px",
          bottom: "120px",
          textAlign: "right",
          opacity,
        }}
      >
        {/* Channel name */}
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              fontFamily: BRAND_FONTS.primary,
              fontSize: "100px",
              fontWeight: 600,
              color: BRAND_COLORS.light,
              margin: 0,
              transform: `translateY(${gatsbyY}px)`,
              letterSpacing: "2px",
              opacity: gatsbyOpacity,
            }}
          >
            GATSBY
          </div>
          <div
            style={{
              fontFamily: BRAND_FONTS.primary,
              fontSize: "100px",
              fontWeight: 600,
              color: BRAND_COLORS.light,
              margin: 0,
              transform: `translateY(${fitzgeraldY}px)`,
              letterSpacing: "2px",
              opacity: fitzgeraldOpacity,
            }}
          >
            FITZGERALD
          </div>
        </div>

        {/* Thanks for watching - White */}
        <p
          style={{
            fontFamily: "le-havre-rounded, sans-serif",
            fontSize: "56px",
            fontWeight: 300,
            fontStyle: "normal",
            color: BRAND_COLORS.light,
            margin: 0,
            letterSpacing: "2px",
            opacity: thanksOpacity,
            transform: `translateY(${thanksY}px)`,
          }}
        >
          Cheers, and thank you for watching!
        </p>

        {/* Subscribe and Like buttons */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            alignItems: "center",
            justifyContent: "flex-end",
            marginTop: "40px",
          }}
        >
          {/* Like Button - First */}
          <div
            style={{
              opacity: likeOpacity,
              transform: `scale(${likeScale})`,
            }}
          >
            <div
              style={{
                padding: "16px 40px",
                background: BRAND_COLORS.yellow,
                borderRadius: "30px",
                fontFamily: BRAND_FONTS.primary,
                fontSize: "32px",
                fontWeight: 600,
                color: BRAND_COLORS.black,
                letterSpacing: "1px",
              }}
            >
              LIKE
            </div>
          </div>

          {/* & symbol */}
          <span
            style={{
              fontFamily: BRAND_FONTS.primary,
              fontSize: "48px",
              fontWeight: 600,
              color: BRAND_COLORS.light,
              opacity: Math.min(subscribeOpacity, likeOpacity),
            }}
          >
            &
          </span>

          {/* Subscribe Button */}
          <div
            style={{
              opacity: subscribeOpacity,
              transform: `scale(${subscribeScale * pulse})`,
            }}
          >
            <div
              style={{
                padding: "16px 40px",
                background: BRAND_COLORS.pink,
                borderRadius: "30px",
                fontFamily: BRAND_FONTS.primary,
                fontSize: "32px",
                fontWeight: 600,
                color: BRAND_COLORS.black,
                letterSpacing: "1px",
              }}
            >
              SUBSCRIBE
            </div>
          </div>
        </div>

        {/* Email */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "30px",
            opacity: subscribeOpacity,
          }}
        >
          <Mail
            size={28}
            color={BRAND_COLORS.light}
            strokeWidth={1.5}
          />
          <p
            style={{
              fontFamily: '"le-havre-rounded", sans-serif',
              fontSize: "30px",
              fontWeight: 300,
              fontStyle: "normal",
              color: BRAND_COLORS.light,
              margin: 0,
              letterSpacing: "1px",
            }}
          >
            gatsbytdfitzgerald@icloud.com
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
