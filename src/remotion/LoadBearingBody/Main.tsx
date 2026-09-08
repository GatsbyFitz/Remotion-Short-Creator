import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

const BASE_FPS = 30;
const DURATION_IN_FRAMES = 205;

// The stack builds from the bottom up, holds just long enough to look stable,
// then the foundation cracks and everything resting on it comes down.
const BUILD_START_FRAME = 16;
const BLOCK_STAGGER = 11;
const BLOCK_FALL_FRAMES = 10;
const CRACK_START_FRAME = 80;
const CRACK_DRAW_FRAMES = 22;
const COLLAPSE_START_FRAME = 106;

const CX = 960;

// Foundation sits wider than the stack — it carries all of it.
const FOUNDATION_TOP = 684;
const FOUNDATION_WIDTH = 780;
const FOUNDATION_HEIGHT = 140;

const BLOCK_WIDTH = 580;
const BLOCK_HEIGHT = 92;
const BLOCK_GAP = 12;

// Bottom to top, so the stack builds in the order it would be laid.
const STACK = ["Ambition", "Relationships", "Identity", "Career"] as const;

// Bottom to top, matching STACK. Hand-picked rather than derived so the blocks
// scatter along genuinely different paths instead of sliding off as one slab.
const COLLAPSE = [
  { dx: 150, rotation: 24 },
  { dx: -80, rotation: -30 },
  { dx: 95, rotation: 36 },
  { dx: 275, rotation: 52 },
] as const;

// The stack topples over the right-hand edge of its own base.
const PIVOT_X = CX + BLOCK_WIDTH / 2;

const SHADOW = "0 10px 30px rgba(0, 0, 0, 0.45)";
// drop-shadow rather than box-shadow for the foundation: it follows the clipped
// silhouette. Applied to the wrapper, not the pieces — per-piece shadows landed
// on the piece below and showed up as a seam while the block was still whole.
const PIECE_SHADOW = "drop-shadow(0 10px 16px rgba(0, 0, 0, 0.45))";

// The crack, in coordinates local to the foundation block. One source of truth:
// the drawn line and both clip paths are all derived from it.
// Fewer, deeper teeth: small zigzags read as a texture at this size, whereas a
// broken edge needs to be legible once the two pieces are metres apart on screen.
// Stays below the BODY label (which ends around y=94) and inside the block.
const CRACK: ReadonlyArray<readonly [number, number]> = [
  [0, 88], [130, 112], [260, 78], [390, 110], [520, 80], [650, 108], [780, 86],
];

const crackLine = CRACK.map(([x, y], i) =>
  `${i === 0 ? "M" : "L"} ${x + CX - FOUNDATION_WIDTH / 2} ${y + FOUNDATION_TOP}`,
).join(" ");

// The upper piece's edge runs 2px past the crack so the two halves overlap
// slightly and show no seam before they separate.
// Every coordinate needs an explicit unit — a bare number makes the whole
// polygon() invalid, and the browser then drops the clip silently, leaving two
// unclipped full blocks stacked on each other instead of two halves.
const UPPER_CLIP = [
  "0px 0px",
  `${FOUNDATION_WIDTH}px 0px`,
  ...[...CRACK].reverse().map(([x, y]) => `${x}px ${y + 2}px`),
].join(", ");

const LOWER_CLIP = [
  ...CRACK.map(([x, y]) => `${x}px ${y}px`),
  `${FOUNDATION_WIDTH}px ${FOUNDATION_HEIGHT}px`,
  `0px ${FOUNDATION_HEIGHT}px`,
].join(", ");

// Each piece parts along its own vector once the foundation gives.
const PIECES = [
  { key: "lower", clip: LOWER_CLIP, dx: 104, dy: 190, rotation: 8, label: false },
  { key: "upper", clip: UPPER_CLIP, dx: -26, dy: 84, rotation: -5, label: true },
] as const;
const TEXT_SHADOW = "0 3px 14px rgba(0, 0, 0, 0.4)";

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

export const LoadBearingBody: React.FC = () => {
  const frame = useCurrentFrame();

  const foundationIn = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const crack = interpolate(
    frame,
    [CRACK_START_FRAME, CRACK_START_FRAME + CRACK_DRAW_FRAMES],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // The whole structure trembles while the crack runs, before anything moves.
  const shudder =
    crack > 0 && crack < 1 ? Math.sin(frame * 2.1) * 3.2 : 0;

  // The stack leans over its base once the foundation gives.
  const tilt = interpolate(
    frame,
    [COLLAPSE_START_FRAME, COLLAPSE_START_FRAME + 30],
    [0, 11],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) },
  );

  // The foundation doesn't just settle — it breaks apart along the crack.
  const split = interpolate(
    frame,
    [COLLAPSE_START_FRAME, COLLAPSE_START_FRAME + 44],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) },
  );

  return (
    <AbsoluteFill>
      {/* Everything built on top of the body. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: `${PIVOT_X}px ${FOUNDATION_TOP}px`,
          transform: `translateX(${shudder}px) rotate(${tilt}deg)`,
        }}
      >
        {STACK.map((label, index) => {
          const bottom = FOUNDATION_TOP - index * (BLOCK_HEIGHT + BLOCK_GAP);
          const top = bottom - BLOCK_HEIGHT;

          const dropStart = BUILD_START_FRAME + index * BLOCK_STAGGER;
          const drop = interpolate(
            frame,
            [dropStart, dropStart + BLOCK_FALL_FRAMES],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) },
          );
          const rebound = interpolate(
            frame,
            [dropStart + BLOCK_FALL_FRAMES, dropStart + BLOCK_FALL_FRAMES + 5, dropStart + BLOCK_FALL_FRAMES + 11],
            [0, -11, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const buildY = interpolate(drop, [0, 1], [-980, 0]) + rebound;

          // The top of the stack has the least holding it down, so it goes first.
          const letGo = COLLAPSE_START_FRAME + 12 + (STACK.length - 1 - index) * 13;
          const fall = interpolate(frame, [letGo, letGo + 42], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const fallY = fall * fall * 1040;
          const fallX = fall * COLLAPSE[index].dx;
          const fallRotation = fall * COLLAPSE[index].rotation;
          const fallOpacity = interpolate(fall, [0, 0.75, 1], [1, 1, 0], {
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={label}
              style={{
                position: "absolute",
                top,
                left: CX - BLOCK_WIDTH / 2,
                width: BLOCK_WIDTH,
                height: BLOCK_HEIGHT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                backgroundColor: BRAND_COLORS.yellow,
                boxShadow: SHADOW,
                opacity: (frame < dropStart ? 0 : 1) * fallOpacity,
                transform: `translate(${fallX}px, ${buildY + fallY}px) rotate(${fallRotation}deg)`,
              }}
            >
              <span
                style={{
                  fontFamily: BRAND_FONTS.primary,
                  fontSize: 46,
                  fontWeight: 600,
                  color: BRAND_COLORS.black,
                  letterSpacing: 1,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* The foundation, split along the crack into two pieces. Each is the full
          block clipped to one side of the break, so they read as one solid slab
          until they part. */}
      <div style={{ position: "absolute", inset: 0, filter: PIECE_SHADOW }}>
        {PIECES.map((piece) => (
        <div
          key={piece.key}
          style={{
            position: "absolute",
            top: FOUNDATION_TOP,
            left: CX - FOUNDATION_WIDTH / 2,
            width: FOUNDATION_WIDTH,
            height: FOUNDATION_HEIGHT,
            opacity: foundationIn,
            transform: `translate(${shudder * 0.4 + split * piece.dx}px, ${
              interpolate(foundationIn, [0, 1], [26, 0]) + split * split * piece.dy
            }px) rotate(${split * piece.rotation}deg)`,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              // Pulls the label up into the upper piece, clear of the break.
              paddingBottom: 48,
              boxSizing: "border-box",
              borderRadius: 12,
              backgroundColor: BRAND_COLORS.pink,
              clipPath: `polygon(${piece.clip})`,
            }}
          >
            {piece.label ? (
              <span
                style={{
                  fontFamily: BRAND_FONTS.primary,
                  fontSize: 68,
                  fontWeight: 600,
                  color: BRAND_COLORS.light,
                  letterSpacing: 4,
                  textShadow: TEXT_SHADOW,
                }}
              >
                BODY
              </span>
            ) : null}
          </div>
        </div>
        ))}
      </div>

      {/* The crack itself, drawn before anything moves. Once the pieces part the
          gap between them is the break, so the line fades out. */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <path
          d={crackLine}
          fill="none"
          stroke={BRAND_COLORS.light}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={
            0.85 *
            interpolate(split, [0, 0.2], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
          // pathLength normalises the path to 1 so the draw-on doesn't depend on
          // measuring the real length of this zigzag.
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - crack}
          transform={`translate(${shudder * 0.4} 0)`}
        />
      </svg>
    </AbsoluteFill>
  );
};
