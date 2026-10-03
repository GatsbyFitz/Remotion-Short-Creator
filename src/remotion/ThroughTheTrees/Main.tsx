import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { BRAND_COLORS } from "../theme";

const BASE_FPS = 30;
// Exactly one wind cycle: every motion completes a whole number of cycles in this
// length. That's what lets the grow-in version hand straight over to the loop
// version with no seam, and the loop version repeat end to end indefinitely.
const DURATION_IN_FRAMES = 300;

// Growth: trunks rise first, then branches reach in and ferns come up, all done
// by GROW_END. Falling leaves only start once there's foliage for them to fall from.
const GROW_END = 70;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
// Slight overshoot, so leaves pop open rather than just scaling up.
const easeOutBack = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

type Point = { x: number; y: number };
type Zone = { x0: number; y0: number; x1: number; y1: number };

// Measured on a gridded frame of the talking-head shot. Nothing is allowed into
// these: face and hair, the shoulder line, torso and both hands, and the logo.
const PROTECTED: Zone[] = [
  { x0: 770, y0: 0, x1: 1180, y1: 560 },
  { x0: 600, y0: 540, x1: 1310, y1: 760 },
  { x0: 1310, y0: 585, x1: 1420, y1: 760 },
  { x0: 420, y0: 760, x1: 1530, y1: 1080 },
  { x0: 50, y0: 905, x1: 205, y1: 1060 },
];

// The furthest any branch or frond rotates, at the peak of a gust, and the most a
// single leaf flutters. Clearance is checked against full movement, not rest.
const MAX_SWAY_DEG = 4.5;
const LEAF_FLUTTER_DEG = 9;

const isClear = (p: Point, pad: number) =>
  PROTECTED.every((z) => p.x < z.x0 - pad || p.x > z.x1 + pad || p.y < z.y0 - pad || p.y > z.y1 + pad);

// All foliage is the theme green. A single flat fill would merge every leaf into
// one silhouette, so variation comes from shades mixed from that same green:
// foliage in front uses the green itself and near shades, growth behind the
// trunks the darkest, so it sits back.
const THEME_GREEN = BRAND_COLORS.yellow;

// Mixes a hex colour toward black (negative amount) or white (positive).
const shade = (hex: string, amount: number) => {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};

const CANOPY_LEAVES = [THEME_GREEN, shade(THEME_GREEN, -0.12), shade(THEME_GREEN, -0.25), shade(THEME_GREEN, -0.38)];
const MID_LEAVES = [shade(THEME_GREEN, -0.5), shade(THEME_GREEN, -0.6)];
const FERN_NEAR = [THEME_GREEN, shade(THEME_GREEN, -0.15), shade(THEME_GREEN, -0.3)];
const FERN_MID = [shade(THEME_GREEN, -0.52), shade(THEME_GREEN, -0.62)];
const FALLING_LEAVES = [THEME_GREEN, shade(THEME_GREEN, 0.3)];
const TRUNK = "#5a3d2b";
const TRUNK_LIGHT = "#7a5540";
const BRANCH_STEM = "#4a3324";
const FERN_STEM = shade(THEME_GREEN, -0.55);

type Leaf = { x: number; y: number; angle: number; length: number; width: number; fill: string; phase: number; t: number };
type Branch = { key: string; anchor: Point; stem: string; stemWidth: number; stemColor: string; leaves: Leaf[]; sway: number; k1: number; k2: number; phase: number; phase2: number };

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

const quadAt = (a: Point, c: Point, b: Point, t: number): Point => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});
const quadAngle = (a: Point, c: Point, b: Point, t: number) =>
  deg(Math.atan2(2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y), 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x)));

const swingAt = (anchor: Point, p: Point) => Math.hypot(p.x - anchor.x, p.y - anchor.y) * Math.sin(rad(MAX_SWAY_DEG));

// A stem that would swing into a protected zone is shortened until it doesn't.
// Pruning only the leaves would leave a bare stalk poking across the subject.
const stemIsClear = (a: Point, c: Point, b: Point) => {
  for (let i = 0; i <= 12; i++) {
    const p = quadAt(a, c, b, i / 12);
    if (!isClear(p, swingAt(a, p) + 6)) return false;
  }
  return true;
};

const pushLeaf = (leaves: Leaf[], key: string, anchor: Point, base: Point, angle: number, length: number, palette: string[], t: number) => {
  const centre = { x: base.x + (Math.cos(rad(angle)) * length) / 2, y: base.y + (Math.sin(rad(angle)) * length) / 2 };
  const flutter = length * Math.sin(rad(LEAF_FLUTTER_DEG));
  if (!isClear(centre, length / 2 + swingAt(anchor, centre) + flutter + 6)) return;
  leaves.push({
    x: base.x,
    y: base.y,
    angle,
    length,
    width: length * (0.26 + random(`${key}-w`) * 0.1),
    fill: palette[Math.floor(random(`${key}-c`) * palette.length)],
    phase: random(`${key}-p`) * Math.PI * 2,
    t,
  });
};

const motion = (key: string, sway: number) => ({
  sway,
  k1: 1 + Math.floor(random(`${key}-k1`) * 2),
  k2: 3 + 2 * Math.floor(random(`${key}-k2`) * 2),
  phase: random(`${key}-phase`) * Math.PI * 2,
  phase2: random(`${key}-phase2`) * Math.PI * 2,
});

// A leafy branch reaching in from outside the frame.
const branch = (key: string, anchor: Point, directionDeg: number, requestedLength: number, count: number, leafSize: number, palette: string[], near: boolean): Branch => {
  const d = rad(directionDeg);
  const bend = (random(`${key}-bend`) - 0.5) * 0.5;
  const shape = (length: number) => {
    const end = { x: anchor.x + Math.cos(d) * length, y: anchor.y + Math.sin(d) * length };
    const control = {
      x: anchor.x + Math.cos(d) * length * 0.5 - Math.sin(d) * bend * length,
      y: anchor.y + Math.sin(d) * length * 0.5 + Math.cos(d) * bend * length,
    };
    return { end, control };
  };
  let length = requestedLength;
  let { end, control } = shape(length);
  while (!stemIsClear(anchor, control, end) && length > 60) {
    length *= 0.9;
    ({ end, control } = shape(length));
  }

  const leaves: Leaf[] = [];
  for (let i = 0; i < count; i++) {
    const t = 0.12 + 0.88 * (i / (count - 1));
    const at = quadAt(anchor, control, end, t);
    const side = i % 2 === 0 ? 1 : -1;
    const angle = quadAngle(anchor, control, end, t) + side * (30 + random(`${key}-s${i}`) * 35);
    const size = leafSize * (1 - 0.35 * t) * (0.75 + random(`${key}-l${i}`) * 0.5);
    pushLeaf(leaves, `${key}-${i}`, anchor, at, angle, size, palette, t);
  }
  const tipAngle = quadAngle(anchor, control, end, 1);
  [-26, 0, 26].forEach((offset, i) => pushLeaf(leaves, `${key}-tip${i}`, anchor, end, tipAngle + offset, leafSize * 0.62, palette, 1));

  return {
    key,
    anchor,
    stem: `M ${anchor.x} ${anchor.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    stemWidth: near ? 9 : 5,
    stemColor: near ? BRANCH_STEM : shade(THEME_GREEN, -0.65),
    leaves,
    ...motion(key, 1.2 + random(`${key}-sway`) * 0.8),
  };
};

// A fern frond: arching up from its base and drooping at the tip, with paired
// leaflets that shrink toward the end.
const frond = (key: string, base: Point, directionDeg: number, requestedLength: number, palette: string[], leafletSize: number): Branch => {
  const d = rad(directionDeg);
  const shape = (length: number) => ({
    end: { x: base.x + Math.cos(d) * length, y: base.y + Math.sin(d) * length + length * 0.2 },
    control: { x: base.x + Math.cos(d) * length * 0.55, y: base.y + Math.sin(d) * length * 0.55 - length * 0.14 },
  });
  let length = requestedLength;
  let { end, control } = shape(length);
  while (!stemIsClear(base, control, end) && length > 60) {
    length *= 0.9;
    ({ end, control } = shape(length));
  }

  const leaves: Leaf[] = [];
  const pairs = 14;
  for (let i = 0; i < pairs; i++) {
    const t = 0.12 + 0.85 * (i / (pairs - 1));
    const at = quadAt(base, control, end, t);
    const along = quadAngle(base, control, end, t);
    const size = leafletSize * (1 - 0.72 * t) * (length / requestedLength);
    pushLeaf(leaves, `${key}-a${i}`, base, at, along - 58, size, palette, t);
    pushLeaf(leaves, `${key}-b${i}`, base, at, along + 58, size, palette, t);
  }
  return {
    key,
    anchor: base,
    stem: `M ${base.x} ${base.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    stemWidth: 4,
    stemColor: FERN_STEM,
    leaves,
    ...motion(key, 1.6 + random(`${key}-sway`) * 0.4),
  };
};

type TimedBranch = Branch & { growStart: number; growDuration: number };
const timed = (list: Branch[], start: number, spread: number, duration: number): TimedBranch[] =>
  list.map((b) => ({ ...b, growStart: start + random(`${b.key}-grow`) * spread, growDuration: duration }));

const fronds = (prefix: string, base: Point, directions: number[], lengths: number[], palette: string[], size: number) =>
  directions.map((dir, i) => frond(`${prefix}${i}`, base, dir, lengths[i], palette, size));

const CANOPY: TimedBranch[] = timed([
  // Top-left.
  branch("tl1", { x: -20, y: 40 }, 15, 620, 22, 95, CANOPY_LEAVES, true),
  branch("tl2", { x: -20, y: 250 }, -8, 420, 14, 85, CANOPY_LEAVES, true),
  branch("tl3", { x: 180, y: -20 }, 62, 380, 14, 80, CANOPY_LEAVES, true),
  branch("tl4", { x: 520, y: -20 }, 100, 300, 12, 78, CANOPY_LEAVES, true),
  // Top-right.
  branch("tr1", { x: 1940, y: 20 }, 168, 700, 24, 100, CANOPY_LEAVES, true),
  branch("tr2", { x: 1940, y: 300 }, 190, 600, 20, 95, CANOPY_LEAVES, true),
  branch("tr3", { x: 1380, y: -20 }, 86, 400, 14, 80, CANOPY_LEAVES, true),
  branch("tr4", { x: 1650, y: -20 }, 100, 300, 12, 85, CANOPY_LEAVES, true),
  branch("tr5", { x: 1940, y: 520 }, 200, 380, 13, 80, CANOPY_LEAVES, true),
  // The lamp: shade (x 1470-1590, y 85-235) and arm (x 1320-1480, down to y 480).
  branch("lampShade", { x: 1520, y: -20 }, 94, 320, 20, 110, CANOPY_LEAVES, true),
  branch("lampGlow", { x: 1700, y: -20 }, 118, 380, 16, 105, CANOPY_LEAVES, true),
  branch("lampArm", { x: 1560, y: -20 }, 112, 560, 18, 90, CANOPY_LEAVES, true),
  // The plate (x 1400-1600, y 390-580), shelf top (y 500-580) and photo frame.
  branch("plate", { x: 1940, y: 420 }, 183, 560, 18, 95, CANOPY_LEAVES, true),
  branch("shelfTop", { x: 1940, y: 600 }, 186, 440, 15, 88, CANOPY_LEAVES, true),
  branch("plateLow", { x: 1940, y: 540 }, 180, 470, 16, 90, CANOPY_LEAVES, true),
  branch("photoFrame", { x: 1470, y: -20 }, 96, 520, 18, 84, CANOPY_LEAVES, true),
  branch("photoFrameLow", { x: 1600, y: 380 }, 160, 260, 10, 80, CANOPY_LEAVES, true),
], 14, 26, 26);

// Behind the trunks.
const MID_GROWTH: TimedBranch[] = timed([
  branch("mr1", { x: 1940, y: 700 }, 195, 260, 10, 70, MID_LEAVES, false),
  ...fronds("fm", { x: 1700, y: 1110 }, [-140, -122, -100, -78, -55, -35], [180, 210, 220, 200, 180, 160], FERN_MID, 46),
], 8, 18, 24);

// In front of the trunks: clumps at the foot of the trees, and big fronds reaching
// in from both edges, close to the lens.
const NEAR_FERNS: TimedBranch[] = timed([
  ...fronds("fle", { x: -30, y: 830 }, [-45, -25, -8], [270, 310, 250], FERN_NEAR, 58),
  ...fronds("flg", { x: 300, y: 1130 }, [-140, -118, -98, -80, -62], [230, 270, 290, 260, 210], FERN_NEAR, 58),
  ...fronds("frg", { x: 1620, y: 1130 }, [-120, -100, -80, -58], [240, 280, 260, 220], FERN_NEAR, 58),
  ...fronds("frg2", { x: 1880, y: 1130 }, [-150, -128, -105, -82], [260, 300, 280, 230], FERN_NEAR, 58),
  ...fronds("fre", { x: 1960, y: 760 }, [198, 215, 232], [300, 280, 240], FERN_NEAR, 58),
  ...fronds("frl", { x: 1960, y: 990 }, [185, 202], [320, 280], FERN_NEAR, 58),
], 22, 22, 22);

// Trunks stand clear of the protected zones: the left trunk's flared root stops
// short of the left hand, the right trunks start past the right hand.
type Trunk = { key: string; cx: number; top: number; bottom: number; lean: number };
const TRUNKS: Trunk[] = [
  { key: "left", cx: 290, top: 112, bottom: 150, lean: 12 },
  { key: "rightA", cx: 1640, top: 116, bottom: 150, lean: -15 },
  { key: "rightB", cx: 1895, top: 150, bottom: 185, lean: 8 },
];
const TRUNK_TOP = -40;
const TRUNK_BOTTOM = 1120;

// Clean tapered trunks that thicken toward the ground and flare at the root.
const TRUNK_SHAPES = TRUNKS.map((t) => {
  const steps = 13;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const y = TRUNK_TOP + u * (TRUNK_BOTTOM - TRUNK_TOP);
    const flare = u > 0.85 ? ((u - 0.85) / 0.15) * 40 : 0;
    const width = t.top + (t.bottom - t.top) * u + flare;
    const centre = t.cx + t.lean * (1 - u) + Math.sin(u * 5 + random(`${t.key}-c`) * 6) * 6;
    left.push({ x: centre - width / 2, y });
    right.push({ x: centre + width / 2, y });
  }
  const outline = [...left, ...[...right].reverse()];
  return {
    key: t.key,
    outline: `M ${outline.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")} Z`,
    highlight: left.map((l, i) => `${(l.x + (right[i].x - l.x) * 0.78).toFixed(1)},${l.y.toFixed(1)}`).join(" "),
    leftEdgeAt: (y: number) => left[Math.round(((y - TRUNK_TOP) / (TRUNK_BOTTOM - TRUNK_TOP)) * steps)].x,
  };
});

// Drifting leaves follow corridors that never cross the face: two diagonals off
// each top corner, and a straight fall down each side.
const CORRIDORS = [
  { start: { x: 760, y: -60 }, end: { x: -80, y: 700 } },
  { start: { x: 640, y: -60 }, end: { x: -80, y: 560 } },
  { start: { x: 1240, y: -60 }, end: { x: 2000, y: 640 } },
  { start: { x: 1420, y: -60 }, end: { x: 2000, y: 480 } },
  { start: { x: 300, y: -60 }, end: { x: 340, y: 1140 } },
  { start: { x: 1720, y: -60 }, end: { x: 1680, y: 1140 } },
];

const FALLING = Array.from({ length: 14 }, (_, i) => ({
  key: `fall${i}`,
  ...CORRIDORS[i % CORRIDORS.length],
  offset: i / 14 + random(`fall${i}-o`) * 0.05,
  // Whole cycles per loop, so each leaf is back at its start when the loop repeats.
  laps: random(`fall${i}-laps`) < 0.35 ? 2 : 1,
  size: 26 + random(`fall${i}-s`) * 24,
  fill: FALLING_LEAVES[Math.floor(random(`fall${i}-c`) * FALLING_LEAVES.length)],
  spin: (random(`fall${i}-dir`) < 0.5 ? -1 : 1) * (1 + Math.floor(random(`fall${i}-spin`) * 3)),
  tumble: 2 + Math.floor(random(`fall${i}-tumble`) * 3),
  wobble: random(`fall${i}-w`) * Math.PI * 2,
}));

const leafPath = (length: number, width: number) =>
  `M 0 0 C ${length * 0.3} ${-width}, ${length * 0.75} ${-width * 0.8}, ${length} 0 C ${length * 0.75} ${width * 0.8}, ${length * 0.3} ${width}, 0 0 Z`;

// Wind comes in two gusts per loop and rolls across the frame from left to right.
const gustAt = (cycle: number, x: number) => Math.pow(0.5 + 0.5 * Math.sin(cycle * 2 + 1.1 - (x / 1920) * 1.2), 3);

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

export type ThroughTheTreesProps = { growIn: boolean };

export const ThroughTheTrees: React.FC<ThroughTheTreesProps> = ({ growIn }) => {
  const frame = useCurrentFrame();
  const growthOf = (start: number, duration: number) => (growIn ? easeOutCubic(clamp01((frame - start) / duration)) : 1);
  const cycle = (frame / DURATION_IN_FRAMES) * Math.PI * 2;
  const overallGust = gustAt(cycle, 960);

  const renderBranch = (b: TimedBranch) => {
    const growth = growthOf(b.growStart, b.growDuration);
    if (growth <= 0) return null;
    const gust = gustAt(cycle, b.anchor.x);
    // Never exceeds MAX_SWAY_DEG: sway ≤ 2, gust factor ≤ 2.2, wave ≤ 1. Eased in
    // with growth so a stem that's only half out doesn't whip about.
    const rotation =
      growth * b.sway * (0.6 + 1.6 * gust) * (0.75 * Math.sin(cycle * b.k1 + b.phase) + 0.25 * Math.sin(cycle * b.k2 + b.phase2));
    return (
      <g key={b.key} transform={`rotate(${rotation} ${b.anchor.x} ${b.anchor.y})`}>
        {/* The stem draws out from its anchor... */}
        <path
          d={b.stem}
          fill="none"
          stroke={b.stemColor}
          strokeWidth={b.stemWidth}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - growth}
        />
        {b.leaves.map((leaf, i) => {
          // ...and each leaf pops open from its base as the stem reaches it.
          // Timed so even a tip leaf (t = 1) is fully open, settled, exactly when
          // growth reaches 1 — otherwise it would still be mid-bounce at the handover
          // to the loop version and visibly shrink.
          const open = growIn ? easeOutBack(clamp01((growth - leaf.t * 0.82) / 0.18)) : 1;
          if (open <= 0) return null;
          // A ripple that runs outward along the stem rather than every leaf in unison.
          const flutter = LEAF_FLUTTER_DEG * (0.6 + 0.4 * gust) * Math.sin(cycle * 4 + leaf.phase - leaf.t * 3);
          return (
            <path
              key={i}
              d={leafPath(leaf.length, leaf.width)}
              fill={leaf.fill}
              transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle + flutter}) scale(${open})`}
            />
          );
        })}
      </g>
    );
  };

  // Trunks rise out of the ground, a few frames apart.
  const trunkGrowth = TRUNK_SHAPES.map((_, i) => growthOf(i * 5, 28));
  const sideBranchGrowth = growthOf(24, 18);
  const sideBranchBase = { x: TRUNK_SHAPES[0].leftEdgeAt(390) + 10, y: 380 };
  const fallIn = growIn ? clamp01((frame - (GROW_END - 10)) / 30) : 1;

  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" role="img" aria-label="Flat illustrated trees and ferns framing the shot, moving in the wind">
        <g>{MID_GROWTH.map(renderBranch)}</g>

        <defs>
          {TRUNK_SHAPES.map((t, i) => (
            <clipPath key={t.key} id={`treesTrunkGrow-${t.key}`}>
              <rect x={0} y={TRUNK_BOTTOM - trunkGrowth[i] * (TRUNK_BOTTOM - TRUNK_TOP)} width={1920} height={TRUNK_BOTTOM - TRUNK_TOP + 40} />
            </clipPath>
          ))}
        </defs>

        <g>
          {TRUNK_SHAPES.map((t) => (
            <g key={t.key} clipPath={`url(#treesTrunkGrow-${t.key})`}>
              <path d={t.outline} fill={TRUNK} />
              <polyline points={t.highlight} fill="none" stroke={TRUNK_LIGHT} strokeWidth={12} strokeLinecap="round" />
            </g>
          ))}
          {/* A side branch off the left trunk, heading away from the subject; it
              grows out once the trunk has risen past it. */}
          {sideBranchGrowth > 0 ? (
            <path
              d={`M ${TRUNK_SHAPES[0].leftEdgeAt(360) + 10} 340 L ${TRUNK_SHAPES[0].leftEdgeAt(420) + 10} 420 Q 170 380 110 300 L 130 286 Q 190 330 ${TRUNK_SHAPES[0].leftEdgeAt(360) + 10} 340 Z`}
              fill={TRUNK}
              transform={`translate(${sideBranchBase.x} ${sideBranchBase.y}) scale(${sideBranchGrowth}) translate(${-sideBranchBase.x} ${-sideBranchBase.y})`}
            />
          ) : null}
        </g>

        <g>{NEAR_FERNS.map(renderBranch)}</g>

        <g>{CANOPY.map(renderBranch)}</g>

        <g opacity={fallIn}>
          {FALLING.map((leaf) => {
            const p = ((frame / DURATION_IN_FRAMES) * leaf.laps + leaf.offset) % 1;
            const dx = leaf.end.x - leaf.start.x;
            const dy = leaf.end.y - leaf.start.y;
            const len = Math.hypot(dx, dy);
            const drift = Math.sin(p * Math.PI * 4 + leaf.wobble) * 40 * (0.8 + 0.6 * overallGust);
            const x = leaf.start.x + dx * p + (-dy / len) * drift;
            const y = leaf.start.y + dy * p + (dx / len) * drift;
            // Flipping over as it falls: squashing one axis through zero reads as
            // a leaf turning edge-on and showing its other side.
            const flip = Math.cos(p * Math.PI * 2 * leaf.tumble);
            return (
              <path
                key={leaf.key}
                d={leafPath(leaf.size, leaf.size * 0.32)}
                fill={leaf.fill}
                transform={`translate(${x} ${y}) rotate(${p * 360 * leaf.spin + drift}) scale(1 ${flip})`}
              />
            );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
