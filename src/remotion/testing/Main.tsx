import React from "react";
import {AbsoluteFill, staticFile} from "remotion";
import {Video} from "@remotion/media";

export const CutHalf: React.FC<{ src?: string; half?: "first" | "second"; durationInSeconds?: number; }> = ({
  src = staticFile("video.mp4"),
  half = "first",
  durationInSeconds,
}) => {
  const halfSeconds = typeof durationInSeconds === "number" ? durationInSeconds / 2 : undefined;
  const trimBefore = half === "second" && halfSeconds ? halfSeconds : undefined;
  const trimAfter = halfSeconds ?? undefined;

  return (
    <AbsoluteFill style={{background: "black"}}>
      <Video
        src={src}
        trimBefore={trimBefore}
        trimAfter={trimAfter}
        style={{width: "100%", height: "100%", objectFit: "cover"}}
      />
    </AbsoluteFill>
  );
};
export default CutHalf;