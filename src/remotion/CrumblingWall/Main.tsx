import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND_COLORS } from "../theme";

const BASE_FPS = 30;
const DURATION_IN_FRAMES = 120; // 4s @ 30fps

const ROWS = 9;
const COLS = 8;

// The wall breaks outward from a point rather than all at once, so the collapse
// reads as something giving way instead of a grid dissolving.
const BREACH_X = 0.42;
const BREACH_Y = 0.55;

const CRUMBLE_START_FRAME = 12;
const SPREAD_FRAMES = 46; // delay from the breach point to the furthest brick
const JITTER_FRAMES = 8; // per-brick scatter so the front isn't a clean ring
const SHUDDER_FRAMES = 7; // brick trembles in place just before it lets go
const FALL_FRAMES = 34;

// Neon green blocks, matching the PrisonBars overlay: the brand accent on the
// lit top edge falling away to the same hue at low luminance, so each block
// still reads as a solid object rather than a flat swatch. The mortar stays
// near-black to keep the joints legible against the green.
const MORTAR = "rgba(0, 0, 0, 0.32)";

const faceFor = (shade: number) =>
  `linear-gradient(160deg, rgba(255,255,255,${0.1 + shade * 0.05}) 0%, rgba(255,255,255,0) 38%), ` +
  `linear-gradient(180deg, ${BRAND_COLORS.yellow} 0%, #cdec55 42%, #8fb02c 100%)`;

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

export const CrumblingWall: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const brickWidth = width / COLS;
  const brickHeight = height / ROWS;

  const bricks: React.ReactNode[] = [];

  for (let row = 0; row < ROWS; row++) {
    // Running bond: every other course is offset by half a brick. Courses run
    // one brick wide on each side so the offset never opens a gap at the edge.
    const offset = row % 2 === 0 ? 0 : -brickWidth / 2;

    for (let col = -1; col <= COLS; col++) {
      const seed = `brick-${row}-${col}`;
      const jitter = random(seed);
      const shade = random(`${seed}-shade`);

      const left = col * brickWidth + offset;
      const top = row * brickHeight;

      // Distance from the breach, normalised so the furthest brick is ~1.
      const cx = (left + brickWidth / 2) / width;
      const cy = (top + brickHeight / 2) / height;
      const distance = Math.min(
        1,
        Math.hypot(cx - BREACH_X, cy - BREACH_Y) / 0.95,
      );

      const releaseFrame =
        CRUMBLE_START_FRAME + distance * SPREAD_FRAMES + jitter * JITTER_FRAMES;

      // Trembles in place, then lets go.
      const shudder = interpolate(
        frame,
        [releaseFrame - SHUDDER_FRAMES, releaseFrame],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      const shudderX = Math.sin(frame * 1.6 + jitter * 10) * 2.4 * shudder;

      const fall = interpolate(frame, [releaseFrame, releaseFrame + FALL_FRAMES], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

      // Accelerating drop, with a little sideways drift and tumble per brick.
      const dropY = fall * fall * (height * 1.15);
      const driftX = fall * (jitter - 0.5) * 70;
      const rotation = fall * (jitter - 0.5) * 75;
      const opacity = interpolate(fall, [0, 0.78, 1], [1, 1, 0], {
        extrapolateRight: "clamp",
      });

      bricks.push(
        <div
          key={seed}
          style={{
            position: "absolute",
            top,
            left,
            width: brickWidth,
            height: brickHeight,
            background: faceFor(shade),
            boxShadow: `inset 0 0 0 2px ${MORTAR}, inset 0 2px 0 rgba(255,255,255,0.06)`,
            opacity,
            transform: `translate(${shudderX + driftX}px, ${dropY}px) rotate(${rotation}deg)`,
            transformOrigin: "center center",
          }}
        />,
      );
    }
  }

  // The whole wall settles a touch as it goes, so the collapse feels weighted.
  const settle = interpolate(frame, [CRUMBLE_START_FRAME, DURATION_IN_FRAMES], [0, 10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateY(${settle}px)` }}>{bricks}</AbsoluteFill>
    </AbsoluteFill>
  );
};
