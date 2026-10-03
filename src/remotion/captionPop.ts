import type { CSSProperties } from "react";
import { interpolate, spring } from "remotion";

// Under-damped so each caption page overshoots slightly (~3.5% at its peak) and
// settles within about 12 frames — a pop rather than a fade. Shared by the
// shorts and social clip captions so both animate the same way.
const POP_SPRING = { damping: 12, stiffness: 220, mass: 0.6 };
const POP_FROM_SCALE = 0.75;
const FADE_FRAMES = 3;

// `frame` counts from the moment the caption page appears.
export const captionPopStyle = (frame: number, fps: number, fontSize: number): CSSProperties => {
  const pop = spring({ frame, fps, config: POP_SPRING });

  return {
    opacity: interpolate(frame, [0, FADE_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    // Scaled from the bottom so the pop grows up out of the caption line rather
    // than outward from its middle, with a small rise to match.
    transformOrigin: "50% 100%",
    transform: `translateY(${(1 - pop) * fontSize * 0.25}px) scale(${interpolate(pop, [0, 1], [POP_FROM_SCALE, 1])})`,
  };
};
