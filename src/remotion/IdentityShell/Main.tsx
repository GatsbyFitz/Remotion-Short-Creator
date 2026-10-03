import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  useCurrentFrame,
} from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

const BASE_FPS = 30;
const DURATION_IN_FRAMES = 182;

// Matches the answer IdentitySilo gives to "This is who I am?", so the identity
// built there is the one that breaks here.
const WORD = "RUNNER";

const IN_END = 26;
const TOUCH_START = 60;
const TOUCH_TAP = 68;
const CRACK_START = 76;
const CRACK_END = 106;
const SHATTER_START = 118;
// Pieces nearest the touch go first, so the break runs along the word the same
// way the cracks did.
const MAX_STAGGER = 14;
const GRAVITY = 1.3;

const FONT_SIZE = 300;
const BASELINE_Y = 640;

// Calibrated from a render: the glyphs occupy roughly x 335..1590, y 410..655.
// The box sits just outside them so every glyph pixel belongs to some shard.
const BOX = { left: 318, right: 1608, top: 392, bottom: 670 };
// The touch lands on the box's bottom-left corner, so the whole word lies in the
// quarter up and to the right of it.
const ORIGIN = { x: BOX.left, y: BOX.bottom };
const MAX_REACH = Math.hypot(BOX.right - ORIGIN.x, BOX.top - ORIGIN.y);

type Point = { x: number; y: number };

// The fracture is a radial web from the touch: rays out from the corner, crossed
// by rings. Rays are aimed at points spread evenly along the far edges of the
// word rather than at evenly spaced angles — from a corner, evenly spaced angles
// crowd almost every ray into the first letter.
const TOP_RAYS = 16;
const RIGHT_RAYS = 4;
const RINGS = 6;
const SUBDIVISIONS = 4;

const RAY_TARGETS: Point[] = [
  ...Array.from({ length: TOP_RAYS }, (_, i) => ({
    x: BOX.left + (i / (TOP_RAYS - 1)) * (BOX.right - BOX.left),
    y: BOX.top,
  })),
  ...Array.from({ length: RIGHT_RAYS }, (_, i) => ({
    x: BOX.right,
    y: BOX.top + ((i + 1) / RIGHT_RAYS) * (BOX.bottom - BOX.top),
  })),
];
const RAY_COUNT = RAY_TARGETS.length;

// The outermost rays run along the box's own edges. They stay perfectly straight
// so no wobble can pull them inside the glyphs and leave a sliver of the word
// that belongs to no shard.
const isBoundaryRay = (i: number) => i === 0 || i === RAY_COUNT - 1;

const VERTICES: Point[][] = Array.from({ length: RAY_COUNT }, (_, i) =>
  Array.from({ length: RINGS + 1 }, (_, k) => {
    if (k === 0) return ORIGIN;
    const target = RAY_TARGETS[i];
    // Rings bunch up near the touch (small pieces there, big ones far away); the
    // last ring sits well past the word so the outer shards fully cover it.
    const reach = k === RINGS ? 1.25 : Math.pow(k / RINGS, 1.35);
    const base = {
      x: ORIGIN.x + (target.x - ORIGIN.x) * reach,
      y: ORIGIN.y + (target.y - ORIGIN.y) * reach,
    };
    if (k === RINGS || isBoundaryRay(i)) return base;
    const jitter = 6 + 20 * (k / RINGS);
    return {
      x: base.x + (random(`v${i}-${k}x`) - 0.5) * 2 * jitter,
      y: base.y + (random(`v${i}-${k}y`) - 0.5) * 2 * jitter,
    };
  }),
);

// A crack between two web vertices, with a little wobble along its length. The
// wobble is seeded by the edge itself, independent of direction, so the two
// shards on either side of a crack trace exactly the same line and meet with no
// gap or overlap.
const edgePoints = (ai: number, ak: number, bi: number, bk: number): Point[] => {
  const forward = ai < bi || (ai === bi && ak <= bk);
  const [pi, pk, qi, qk] = forward ? [ai, ak, bi, bk] : [bi, bk, ai, ak];
  const p = VERTICES[pi][pk];
  const q = VERTICES[qi][qk];
  const length = Math.hypot(q.x - p.x, q.y - p.y);
  const straight =
    length < 1 || (pi === qi && isBoundaryRay(pi)) || (pk === RINGS && qk === RINGS);
  const nx = length ? -(q.y - p.y) / length : 0;
  const ny = length ? (q.x - p.x) / length : 0;

  const points: Point[] = [p];
  for (let s = 1; s < SUBDIVISIONS; s++) {
    const t = s / SUBDIVISIONS;
    const offset = straight
      ? 0
      : (random(`e${pi}-${pk}_${qi}-${qk}_${s}`) - 0.5) * 2 * 0.07 * length;
    points.push({
      x: p.x + (q.x - p.x) * t + nx * offset,
      y: p.y + (q.y - p.y) * t + ny * offset,
    });
  }
  points.push(q);
  return forward ? points : points.reverse();
};

const toAttr = (points: Point[]) => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const distanceFromTouch = (p: Point) => Math.hypot(p.x - ORIGIN.x, p.y - ORIGIN.y);

type Shard = {
  id: number;
  points: string;
  centroid: Point;
  delay: number;
  vx: number;
  vy: number;
  spin: number;
};

// Each cell of the web between two rays and two rings is one shard.
const SHARDS: Shard[] = [];
for (let i = 0; i < RAY_COUNT - 1; i++) {
  for (let k = 0; k < RINGS; k++) {
    const outline = [
      ...(k === 0 ? [] : edgePoints(i, k, i + 1, k).slice(0, -1)),
      ...edgePoints(i + 1, k, i + 1, k + 1).slice(0, -1),
      ...edgePoints(i + 1, k + 1, i, k + 1).slice(0, -1),
      ...edgePoints(i, k + 1, i, k).slice(0, -1),
    ];
    const centroid = {
      x: outline.reduce((sum, p) => sum + p.x, 0) / outline.length,
      y: outline.reduce((sum, p) => sum + p.y, 0) / outline.length,
    };
    const id = SHARDS.length;
    const away = distanceFromTouch(centroid) || 1;
    const speed = 1 + random(`speed${id}`) * 2.5;
    const pop = 0.6 + random(`pop${id}`) * 2.2;

    SHARDS.push({
      id,
      points: toAttr(outline),
      centroid,
      delay: Math.min(1, away / MAX_REACH) * MAX_STAGGER,
      // Knocked away from the touch, with a small lift before gravity takes it.
      vx: ((centroid.x - ORIGIN.x) / away) * speed,
      vy: ((centroid.y - ORIGIN.y) / away) * speed - pop,
      spin: (random(`spin${id}`) - 0.5) * 9,
    });
  }
}

type Crack = { points: Point[]; near: number; far: number };

// The same lines the shards are cut along, drawn outward from the touch.
const orient = (points: Point[]): Crack => {
  const a = distanceFromTouch(points[0]);
  const b = distanceFromTouch(points[points.length - 1]);
  return a <= b
    ? { points, near: a, far: b }
    : { points: [...points].reverse(), near: b, far: a };
};

const CRACKS: Crack[] = [
  ...Array.from({ length: RAY_COUNT }, (_, i) => i)
    .filter((i) => !isBoundaryRay(i))
    .flatMap((i) => Array.from({ length: RINGS }, (_, k) => orient(edgePoints(i, k, i, k + 1)))),
  ...Array.from({ length: RAY_COUNT - 1 }, (_, i) => i).flatMap((i) =>
    Array.from({ length: RINGS - 1 }, (_, k) => orient(edgePoints(i, k + 1, i + 1, k + 1))),
  ),
];

// Cut a polyline off at a fraction of its length, for cracks still running.
const truncate = (points: Point[], fraction: number): Point[] => {
  if (fraction >= 1) return points;
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let remaining = lengths.reduce((sum, l) => sum + l, 0) * fraction;
  const out: Point[] = [points[0]];
  for (let i = 0; i < lengths.length; i++) {
    if (remaining >= lengths[i]) {
      out.push(points[i + 1]);
      remaining -= lengths[i];
    } else {
      const t = lengths[i] ? remaining / lengths[i] : 0;
      out.push({
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      });
      break;
    }
  }
  return out;
};

const DROP_SHADOW = "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5))";

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

export const IdentityShell: React.FC = () => {
  const frame = useCurrentFrame();

  const wordIn = interpolate(frame, [0, IN_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const touch =
    interpolate(frame, [TOUCH_START, TOUCH_START + 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(frame, [CRACK_END, SHATTER_START], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const tapPulse = interpolate(frame, [TOUCH_TAP, TOUCH_TAP + 4, TOUCH_TAP + 10], [1, 1.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Accelerating: the fracture outruns the eye rather than creeping across.
  const crackRadius =
    interpolate(frame, [CRACK_START, CRACK_END], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    }) * MAX_REACH;

  const shudder =
    frame >= CRACK_START && frame < CRACK_END
      ? Math.sin(frame * 2.3) * interpolate(frame, [CRACK_START, CRACK_END], [4, 0])
      : 0;

  const shattered = frame >= SHATTER_START;

  const letters = (props: React.SVGProps<SVGTextElement>) => (
    <text
      x={960}
      y={BASELINE_Y}
      textAnchor="middle"
      style={{ fontFamily: BRAND_FONTS.primary, fontWeight: 600, fontSize: FONT_SIZE, letterSpacing: 6 }}
      {...props}
    >
      {WORD}
    </text>
  );

  const solid = { fill: BRAND_COLORS.light, stroke: BRAND_COLORS.light, strokeWidth: 5, strokeLinejoin: "round" as const };

  return (
    <AbsoluteFill>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        role="img"
        aria-label={`The word ${WORD}, solid until a small touch cracks it and it shatters`}
        style={{ filter: DROP_SHADOW }}
      >
        <defs>
          <clipPath id="shellLetters">{letters({})}</clipPath>
          {SHARDS.map((shard) => (
            <clipPath key={shard.id} id={`shellShard-${shard.id}`}>
              <polygon points={shard.points} />
            </clipPath>
          ))}
        </defs>

        {!shattered ? (
          // Whole: one word, with the cracks running across it.
          <g opacity={wordIn} transform={`translate(${shudder} 0)`}>
            {letters(solid)}
            <g clipPath="url(#shellLetters)">
              {CRACKS.map((crack, i) => {
                const span = crack.far - crack.near;
                const drawn =
                  span < 1
                    ? crackRadius >= crack.near
                      ? 1
                      : 0
                    : Math.min(1, Math.max(0, (crackRadius - crack.near) / span));
                if (drawn <= 0) return null;
                return (
                  <polyline
                    key={i}
                    points={toAttr(truncate(crack.points, drawn))}
                    fill="none"
                    stroke={BRAND_COLORS.pink}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
            </g>
          </g>
        ) : (
          // Broken: the same word, now one clipped copy per shard. At rest they
          // tile back into exactly the cracked word above, so the handover is
          // invisible — then each one falls on its own.
          SHARDS.map((shard) => {
            const t = Math.max(0, frame - SHATTER_START - shard.delay);
            const opacity = interpolate(t, [20, 34], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            if (opacity <= 0) return null;

            const dx = shard.vx * t;
            const dy = shard.vy * t + 0.5 * GRAVITY * t * t;
            const angle = shard.spin * t;

            return (
              <g
                key={shard.id}
                opacity={opacity}
                transform={`translate(${dx} ${dy}) rotate(${angle} ${shard.centroid.x} ${shard.centroid.y})`}
              >
                <g clipPath={`url(#shellShard-${shard.id})`}>
                  {letters(solid)}
                  {/* Its broken edge travels with it. Clipped to the shard, so each
                      side of a crack shows half the line and together they make
                      the full width the crack had before the break. */}
                  <g clipPath="url(#shellLetters)">
                    <polygon
                      points={shard.points}
                      fill="none"
                      stroke={BRAND_COLORS.pink}
                      strokeWidth={2.4}
                      strokeLinejoin="round"
                    />
                  </g>
                </g>
              </g>
            );
          })
        )}

        {/* The touch: small, and that's the point. */}
        <circle
          cx={ORIGIN.x}
          cy={ORIGIN.y}
          r={11 * tapPulse}
          fill={BRAND_COLORS.pink}
          opacity={touch}
        />
      </svg>
    </AbsoluteFill>
  );
};
