import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";
import { captionPopStyle } from "../captionPop";

// Kept clear of Instagram's own UI: the top bar, the caption and buttons along
// the bottom, and the like/comment/share column down the right.
const LAYOUT = {
  top: { justifyContent: "flex-start", paddingTop: 0.16, paddingBottom: 0, paddingRight: 0.08 },
  center: { justifyContent: "center", paddingTop: 0, paddingBottom: 0.16, paddingRight: 0.08 },
  bottom: { justifyContent: "flex-end", paddingTop: 0, paddingBottom: 0.24, paddingRight: 0.18 },
} as const;

export const ReelText: React.FC<{ text: string; position: "top" | "center" | "bottom" }> = ({ text, position }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const layout = LAYOUT[position];

  // Hooks and headlines up top and in the middle; smaller labels low down.
  const headline = position !== "bottom";
  const fontSize = Math.round(width * (headline ? 0.082 : 0.06));

  return (
    <AbsoluteFill
      style={{
        justifyContent: layout.justifyContent,
        alignItems: "center",
        paddingTop: height * layout.paddingTop,
        paddingBottom: height * layout.paddingBottom,
        paddingLeft: width * 0.08,
        paddingRight: width * layout.paddingRight,
      }}
    >
      <div
        style={{
          fontFamily: BRAND_FONTS.primary,
          fontWeight: 600,
          fontSize,
          lineHeight: 1.1,
          textAlign: "center",
          color: headline ? BRAND_COLORS.yellow : BRAND_COLORS.light,
          WebkitTextStroke: `${Math.max(2, Math.round(fontSize * 0.05))}px ${BRAND_COLORS.black}`,
          paintOrder: "stroke fill",
          textShadow: `0 ${Math.round(fontSize * 0.06)}px ${Math.round(fontSize * 0.14)}px rgba(0,0,0,0.55)`,
          ...captionPopStyle(frame, fps, fontSize),
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
