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
const DURATION_IN_FRAMES = 240;

const BUILD_END = 38;
const ROOT_START = 44;
const ROOT_END = 182;
// The roots are already well under way by the time the ground opens up — you
// catch them mid-work rather than watching them start.
const REVEAL_START = 88;
const REVEAL_END = 114;
const GROW_START = 160;
const GROW_END = 216;

const GROUND_Y = 640;
const STEM_X = 960;
const BASE = { x: STEM_X, y: GROUND_Y };

const GROUND_HALF_WIDTH = 250;
const BARE_TOP = 530;
const GROWN_TOP = 180;

type Point = { x: number; y: number };
// A tapered length of wood: wider where it leaves its parent, narrower at its
// own tip, and slightly bent. d0/d1 are its distance from the base along the
// tree, which is what growth advances through.
type Limb = { a: Point; c: Point; b: Point; w0: number; w1: number; d0: number; d1: number; level: number };

const rad = (d: number) => (d * Math.PI) / 180;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// Slight overshoot, so leaves pop open rather than just scaling up.
const easeOutBack = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

// Mixes a hex colour toward black (negative) or white (positive).
const shade = (hex: string, amount: number) => {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};

// Wood is a darker mix of the same green, so the leaves read as foliage on top of
// branches rather than merging into one silhouette.
const WOOD = shade(BRAND_COLORS.yellow, -0.32);
// A second leaf tone, so the canopy has depth instead of reading as one flat mass.
const LEAF_SHADE = shade(BRAND_COLORS.yellow, -0.16);
const quadAt = (a: Point, c: Point, b: Point, t: number): Point => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});

// Grown once at module scope and seeded, so tree and roots are identical on every
// frame — with Math.random they would rewrite themselves 30 times a second.
const branchOut = (
  limbs: Limb[],
  from: Point,
  angleDeg: number,
  length: number,
  width: number,
  level: number,
  dist: number,
  key: string,
  opts: { depth: number; decay: number; taper: number; spread: [number, number]; minWidth: number; firstBoost?: number },
) => {
  const d = rad(angleDeg);
  const bend = (random(`${key}-bend`) - 0.5) * 0.3;
  const end = { x: from.x + Math.cos(d) * length, y: from.y + Math.sin(d) * length };
  const c = {
    x: from.x + Math.cos(d) * length * 0.5 - Math.sin(d) * bend * length,
    y: from.y + Math.sin(d) * length * 0.5 + Math.cos(d) * bend * length,
  };
  const w1 = Math.max(opts.minWidth, width * opts.taper);
  limbs.push({ a: from, c, b: end, w0: width, w1, d0: dist, d1: dist + length, level });
  if (level >= opts.depth) return;

  // Two ways on, occasionally three low down, each at its own angle — a tree
  // that forks evenly every time reads as a diagram.
  const spread = opts.spread[0] + random(`${key}-spread`) * (opts.spread[1] - opts.spread[0]);
  const three = level < 2 && random(`${key}-three`) < 0.4;
  const offsets = three ? [-spread, (random(`${key}-mid`) - 0.5) * 12, spread] : [-spread, spread];
  offsets.forEach((offset, i) => {
    const jitter = (random(`${key}-j${i}`) - 0.5) * 12;
    // The first pair of limbs run long, which keeps the trunk short next to the
    // crown. The whole tree is scaled to a fixed height, so shortening the trunk
    // on its own would just scale back up; the ratio is what matters.
    const childLength =
      level === 0 && opts.firstBoost
        ? length * opts.firstBoost
        : length * (opts.decay + random(`${key}-len${i}`) * 0.08);
    branchOut(limbs, end, angleDeg + offset + jitter, childLength, w1, level + 1, dist + length, `${key}-${i}`, opts);
  });
};

const buildTree = () => {
  const limbs: Limb[] = [];
  // A short first length of trunk, so the tree has already forked once by the
  // height it stands at in winter — a bare stick with no forks isn't a tree.
  branchOut(limbs, BASE, -90, 95, 38, 0, 0, "tree", {
    depth: 6,
    decay: 0.78,
    taper: 0.7,
    spread: [14, 28],
    minWidth: 1.5,
    firstBoost: 1.9,
  });
  return limbs;
};

const buildRoots = () => {
  const limbs: Limb[] = [];
  // Five main roots fanning out and down.
  [30, 62, 90, 118, 150].forEach((angle, i) =>
    branchOut(limbs, BASE, angle, 140, 26, 0, 0, `root${i}`, {
      depth: 3,
      decay: 0.7,
      taper: 0.6,
      spread: [22, 42],
      minWidth: 1.4,
    }),
  );
  return limbs;
};

const topOf = (limbs: Limb[], reveal: number, maxDist: number) => {
  let top = GROUND_Y;
  for (const limb of limbs) {
    const t = Math.min(1, Math.max(0, (reveal * maxDist - limb.d0) / (limb.d1 - limb.d0)));
    if (t <= 0) continue;
    for (let i = 1; i <= 4; i++) top = Math.min(top, quadAt(limb.a, limb.c, limb.b, (t * i) / 4).y);
  }
  return top;
};

const scaleLimbs = (limbs: Limb[], k: number): Limb[] =>
  limbs.map((l) => ({
    a: { x: BASE.x + (l.a.x - BASE.x) * k, y: BASE.y + (l.a.y - BASE.y) * k },
    c: { x: BASE.x + (l.c.x - BASE.x) * k, y: BASE.y + (l.c.y - BASE.y) * k },
    b: { x: BASE.x + (l.b.x - BASE.x) * k, y: BASE.y + (l.b.y - BASE.y) * k },
    w0: l.w0 * k,
    w1: l.w1 * k,
    d0: l.d0 * k,
    d1: l.d1 * k,
    level: l.level,
  }));

const rawTree = buildTree();
const rawTreeMax = Math.max(...rawTree.map((l) => l.d1));
// Scaled so the fully grown crown lands on GROWN_TOP rather than wherever the
// recursion happened to finish.
const TREE = scaleLimbs(rawTree, (GROUND_Y - GROWN_TOP) / (GROUND_Y - topOf(rawTree, 1, rawTreeMax)));
const TREE_MAX_DIST = Math.max(...TREE.map((l) => l.d1));

// How far the tree has grown when it's the bare winter stem: the reveal whose
// crown sits at the old-height marker.
const WINTER_REVEAL = (() => {
  let best = 0.2;
  let closest = Infinity;
  for (let r = 0.04; r <= 1; r += 0.01) {
    const gap = Math.abs(topOf(TREE, r, TREE_MAX_DIST) - BARE_TOP);
    if (gap < closest) {
      closest = gap;
      best = r;
    }
  }
  return best;
})();

type LeafBit = { x: number; y: number; angle: number; size: number; d: number; dark: boolean };

// Only on the outer twigs, so growth puts leaves out last — and in winter, when
// nothing past the first fork is out yet, the tree is bare on its own.
const buildLeaves = (limbs: Limb[]): LeafBit[] => {
  const leaves: LeafBit[] = [];
  limbs.forEach((limb, i) => {
    if (limb.level < 5) return;
    [0.45, 0.9].forEach((t, j) => {
      const at = quadAt(limb.a, limb.c, limb.b, t);
      const along = (Math.atan2(limb.b.y - limb.a.y, limb.b.x - limb.a.x) * 180) / Math.PI;
      const side = j % 2 === 0 ? 1 : -1;
      leaves.push({
        x: at.x,
        y: at.y,
        angle: along + side * (40 + random(`leaf${i}-${j}-a`) * 45),
        size: 22 + random(`leaf${i}-${j}-s`) * 16,
        dark: random(`leaf${i}-${j}-t`) < 0.45,
        d: limb.d0 + (limb.d1 - limb.d0) * t,
      });
    });
  });
  return leaves;
};

const leafShape = (size: number) => {
  const w = size * 0.55;
  return `M 0 0 C ${size * 0.3} ${-w}, ${size * 0.75} ${-w * 0.8}, ${size} 0 C ${size * 0.75} ${w * 0.8}, ${size * 0.3} ${w}, 0 0 Z`;
};

const LEAVES = buildLeaves(TREE);

const ROOTS = buildRoots();
const ROOTS_MAX_DIST = Math.max(...ROOTS.map((l) => l.d1));

// The visible part of a limb, as a tapered outline: down one side and back the
// other, so it narrows along its length instead of being a constant-width stroke.
const limbPath = (l: Limb, t: number) => {
  const tip = quadAt(l.a, l.c, l.b, t);
  const mid = quadAt(l.a, l.c, l.b, t / 2);
  const w1 = l.w0 + (l.w1 - l.w0) * t;
  const perp = (from: Point, to: Point) => {
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return { x: -(to.y - from.y) / len, y: (to.x - from.x) / len };
  };
  const n0 = perp(l.a, mid);
  const n1 = perp(mid, tip);
  const nm = perp(l.a, tip);
  const wm = (l.w0 + w1) / 2;
  return (
    `M ${l.a.x + n0.x * l.w0 / 2} ${l.a.y + n0.y * l.w0 / 2} ` +
    `Q ${mid.x + nm.x * wm / 2} ${mid.y + nm.y * wm / 2} ${tip.x + n1.x * w1 / 2} ${tip.y + n1.y * w1 / 2} ` +
    `L ${tip.x - n1.x * w1 / 2} ${tip.y - n1.y * w1 / 2} ` +
    `Q ${mid.x - nm.x * wm / 2} ${mid.y - nm.y * wm / 2} ${l.a.x - n0.x * l.w0 / 2} ${l.a.y - n0.y * l.w0 / 2} Z`
  );
};

const revealed = (limbs: Limb[], reveal: number, maxDist: number, fill: string) =>
  limbs.map((limb, i) => {
    const t = Math.min(1, Math.max(0, (reveal * maxDist - limb.d0) / (limb.d1 - limb.d0)));
    if (t <= 0.01) return null;
    return <path key={i} d={limbPath(limb, t)} fill={fill} />;
  });

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

export const RootsInWinter: React.FC = () => {
  const frame = useCurrentFrame();

  const build = interpolate(frame, [0, BUILD_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Runs through the still stretch, whether or not anyone can see it yet.
  const rootProgress = interpolate(frame, [ROOT_START, ROOT_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.3, 0, 0.25, 1),
  });

  const buried = interpolate(frame, [REVEAL_START, REVEAL_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const growth = interpolate(frame, [GROW_START, GROW_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // The same tree throughout: in winter only its first forks are out, and growth
  // carries it the rest of the way.
  const treeReveal = WINTER_REVEAL * build + (1 - WINTER_REVEAL) * growth;
  // Pink while it stands still through the winter, green the moment it grows. A
  // hard switch rather than an interpolation — pink to green runs via a muddy orange.
  const treeColor = growth > 0 ? WOOD : BRAND_COLORS.pink;

  return (
    <AbsoluteFill>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        role="img"
        aria-label="A bare tree above ground while roots spread unseen below, then growth past its old height"
        style={{ filter: "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5))" }}
      >
        {/* Below ground: the work nobody watching can see. */}
        <g opacity={buried}>{revealed(ROOTS, rootProgress, ROOTS_MAX_DIST, BRAND_COLORS.yellow)}</g>

        {/* The line everything is judged from. */}
        <line
          x1={STEM_X - GROUND_HALF_WIDTH * build}
          y1={GROUND_Y}
          x2={STEM_X + GROUND_HALF_WIDTH * build}
          y2={GROUND_Y}
          stroke={BRAND_COLORS.light}
          strokeWidth={6}
          strokeLinecap="round"
        />

        <g>{revealed(TREE, treeReveal, TREE_MAX_DIST, treeColor)}</g>

        {/* Leaves unfurl behind the growth, once the twig holding them is out. */}
        {growth > 0
          ? LEAVES.map((leaf, i) => {
              const open = easeOutBack(clamp01((treeReveal * TREE_MAX_DIST - leaf.d - 6) / 40));
              if (open <= 0) return null;
              return (
                <path
                  key={i}
                  d={leafShape(leaf.size)}
                  fill={leaf.dark ? LEAF_SHADE : BRAND_COLORS.yellow}
                  transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle}) scale(${open})`}
                />
              );
            })
          : null}
      </svg>
    </AbsoluteFill>
  );
};
