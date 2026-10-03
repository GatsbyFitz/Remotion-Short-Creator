import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  useCurrentFrame,
} from "remotion";
import { BRAND_COLORS } from "../theme";

const BASE_FPS = 30;
const DURATION_IN_FRAMES = 215;

const DRAW_START_FRAME = 6;
const DRAW_END_FRAME = 76;
const UNDO_START_FRAME = 104;
const UNDO_END_FRAME = 194;

type Point = { x: number; y: number };

// Points are laid down at a roughly constant spacing so that a fraction of the
// array is a fraction of the thread's actual length. That's what lets the body
// give up exactly as much string as the floor receives.
const STEP_PX = 6;

const walkLine = (from: Point, to: Point): Point[] => {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.round(distance / STEP_PX));
  return Array.from({ length: steps }, (_, i) => {
    const t = i / steps;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  });
};

const HEAD_CENTRE = { x: 960, y: 224 };
const HEAD_RADIUS = 44;

const walkPolyline = (points: Point[]): Point[] =>
  points.flatMap((point, i) => (i === 0 ? [point] : walkLine(points[i - 1], point)));

// The head is walked as an arc between the two sides of the neck, over the top,
// so the outline runs continuously from one shoulder to the other.
const walkHeadArc = (fromDeg: number, toDeg: number): Point[] => {
  const sweep = Math.abs(toDeg - fromDeg);
  const steps = Math.max(24, Math.round(((sweep / 360) * 2 * Math.PI * HEAD_RADIUS) / STEP_PX));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const deg = fromDeg + ((toDeg - fromDeg) * i) / steps;
    const angle = (deg * Math.PI) / 180;
    return {
      x: HEAD_CENTRE.x + Math.cos(angle) * HEAD_RADIUS,
      y: HEAD_CENTRE.y + Math.sin(angle) * HEAD_RADIUS,
    };
  });
};

// The silhouette, traced as one closed contour: down the inside of one leg,
// round the foot, up the outside, up the torso, out and around the arm, over the
// head, and back down the other side. Opened at the crotch, so that's where the
// loose end is and where the unwinding starts.
//
// Proportioned to roughly 7.7 heads tall, with shoulders about two head-widths
// across and a waist narrower than both shoulders and hips.
const OUTLINE_TO_HEAD: Point[] = [
  { x: 960, y: 548 },
  // Inner left leg, down.
  { x: 936, y: 692 }, { x: 940, y: 828 },
  { x: 940, y: 856 }, { x: 896, y: 856 },
  // Outer left leg, up.
  { x: 924, y: 828 }, { x: 910, y: 752 }, { x: 908, y: 692 },
  { x: 890, y: 610 }, { x: 886, y: 525 },
  // Left torso: waist pulls in, chest widens back out.
  { x: 904, y: 455 }, { x: 884, y: 370 }, { x: 880, y: 352 },
  // Inner left arm, down.
  { x: 870, y: 447 }, { x: 856, y: 578 }, { x: 858, y: 604 },
  // Hand.
  { x: 834, y: 606 }, { x: 830, y: 578 },
  // Outer left arm, up to the shoulder.
  { x: 844, y: 445 }, { x: 874, y: 305 },
  { x: 943, y: 296 }, { x: 943, y: 265 },
];

const OUTLINE_FROM_HEAD: Point[] = [
  { x: 977, y: 265 }, { x: 977, y: 296 },
  { x: 1046, y: 305 },
  // Outer right arm, down.
  { x: 1076, y: 445 }, { x: 1090, y: 578 },
  { x: 1086, y: 606 }, { x: 1062, y: 604 },
  // Inner right arm, up to the armpit.
  { x: 1064, y: 578 }, { x: 1050, y: 447 }, { x: 1040, y: 352 },
  // Right torso, down.
  { x: 1036, y: 370 }, { x: 1016, y: 455 }, { x: 1034, y: 525 },
  // Outer right leg, down.
  { x: 1030, y: 610 }, { x: 1012, y: 692 }, { x: 1010, y: 752 }, { x: 996, y: 828 },
  { x: 1024, y: 856 }, { x: 980, y: 856 },
  // Inner right leg, back up to the crotch.
  { x: 980, y: 828 }, { x: 984, y: 692 },
  { x: 960, y: 548 },
];

const FIGURE_POINTS: Point[] = [
  ...walkPolyline(OUTLINE_TO_HEAD),
  // From the left of the neck, up over the crown, down to the right of it.
  ...walkHeadArc(113, 427),
  ...walkPolyline(OUTLINE_FROM_HEAD),
];

// A flattened spiral: string dropped on a floor coils rather than lying flat.
// Generated from the centre outward, because the far end of the thread falls
// first and everything released later wraps around the outside of it.
const HEAP_CENTRE = { x: 960, y: 934 };
const HEAP_POINTS: Point[] = Array.from({ length: 290 }, (_, i) => {
  const angle = i * 0.15;
  // Seeded rather than Math.random: every frame must generate the same coil, or
  // it would crawl between frames.
  const slack = (random(`heap-${i}`) - 0.5) * 14;
  const radius = 18 + angle * 2.4 + slack;
  return {
    x: HEAP_CENTRE.x + Math.cos(angle) * radius * 1.7,
    y: HEAP_CENTRE.y + Math.sin(angle) * radius * 0.5,
  };
});

// The length still hanging between the body and the floor, drooping under its
// own weight.
const danglePoints = (from: Point, to: Point): Point[] => {
  const controlX = (from.x + to.x) / 2;
  const controlY = (from.y + to.y) / 2 + 46;
  const steps = 16;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const inv = 1 - t;
    return {
      x: inv * inv * from.x + 2 * inv * t * controlX + t * t * to.x,
      y: inv * inv * from.y + 2 * inv * t * controlY + t * t * to.y,
    };
  });
};

const toPath = (points: Point[]) =>
  points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

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

export const UnravellingBody: React.FC = () => {
  const frame = useCurrentFrame();

  const drawn = interpolate(frame, [DRAW_START_FRAME, DRAW_END_FRAME], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Steady and unhurried — it comes apart at its own pace rather than being pulled.
  const undone = interpolate(frame, [UNDO_START_FRAME, UNDO_END_FRAME], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // While drawing, `drawn` is the limit; while unwinding, `1 - undone` is. The
  // thread the body gives up is exactly the thread the floor takes on.
  const figureCount = Math.floor(Math.min(drawn, 1 - undone) * FIGURE_POINTS.length);
  const heapCount = Math.floor(undone * HEAP_POINTS.length);

  const figurePart = FIGURE_POINTS.slice(0, figureCount);
  // Reversed: the thread runs from the coil's outer edge inward, so its loose
  // end sits at the centre where it first landed.
  const heapPart = HEAP_POINTS.slice(0, heapCount).reverse();

  const strand =
    figurePart.length > 1 && heapPart.length > 1
      ? danglePoints(figurePart[figurePart.length - 1], heapPart[0])
      : [];

  const thread = [...figurePart, ...strand, ...heapPart];

  return (
    <AbsoluteFill>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        role="img"
        aria-label="A single continuous string shaped like a body, unwinding itself into a coil on the floor"
        style={{ filter: "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5))" }}
      >
        {thread.length > 1 ? (
          <path
            d={toPath(thread)}
            fill="none"
            stroke={BRAND_COLORS.yellow}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
    </AbsoluteFill>
  );
};
