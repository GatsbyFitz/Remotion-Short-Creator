import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";

type ParentItem = {
  label: string;
  children?: readonly string[];
};

const MAIN_ITEMS: readonly ParentItem[] = [
  { label: "Preparation", children: ["Foot Care", "Socks", "Shoes"] },
  { label: "Morning", children: ["Breakfast", "Hydration", "Warm-Up"] },
  { label: "Racetime" },
];

const X_MAIN = 90;
const X_SUB = 190;
const Y0 = 90;
const MAIN_ROW_HEIGHT = 150;
const SUB_OFFSET = 110;

const FADE_START = 10;
const FADE_STEP = 15;

const DIM_OPACITY = 0.5;

// Parents with no children (never get their own "active chapter") just dim
// shortly after they appear.
const COLOR_START = 85;
const COLOR_END = 115;

const INSERT_START = 150; // first chapter's first child slide-in
const INSERT_STEP = 30; // 1s @ 30fps between each child within a chapter
const CHILD_SETTLE_FRAMES = 40; // approx time for a child's spring to settle
const CHAPTER_HOLD_FRAMES = 20; // hold once a chapter's children are all in
const SWITCH_DURATION = 30; // crossfade length when handing off to the next chapter

const ITEM_SHADOW = "0 8px 20px rgba(0, 0, 0, 0.35)";

// Every parent with children gets a turn being "active" (full opacity),
// one after another, in the order they appear in MAIN_ITEMS.
type Chapter = {
  parentIndex: number;
  insertStart: number;
  switchStart: number;
  switchEnd: number;
};

const chapters: Chapter[] = (() => {
  const result: Chapter[] = [];
  let cursor = INSERT_START;

  MAIN_ITEMS.forEach((parent, parentIndex) => {
    const childCount = parent.children?.length ?? 0;
    if (childCount === 0) {
      return;
    }
    const insertStart = cursor;
    const lastChildStart = insertStart + (childCount - 1) * INSERT_STEP;
    const switchStart = lastChildStart + CHILD_SETTLE_FRAMES + CHAPTER_HOLD_FRAMES;
    const switchEnd = switchStart + SWITCH_DURATION;
    result.push({ parentIndex, insertStart, switchStart, switchEnd });
    cursor = switchEnd + CHAPTER_HOLD_FRAMES;
  });

  return result;
})();

const lastChapter = chapters[chapters.length - 1];
export const TABLE_OF_CONTENTS_END_FRAME = lastChapter
  ? lastChapter.insertStart +
    (MAIN_ITEMS[lastChapter.parentIndex].children!.length - 1) * INSERT_STEP +
    CHILD_SETTLE_FRAMES
  : INSERT_START;

const parentActiveOpacity = (parentIndex: number, frame: number): number => {
  const chapterIndex = chapters.findIndex((c) => c.parentIndex === parentIndex);

  if (chapterIndex === -1) {
    // Never gets its own chapter — just settles into the dim state.
    return interpolate(frame, [COLOR_START, COLOR_END], [1, DIM_OPACITY], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  const chapter = chapters[chapterIndex];
  const previousChapter = chapters[chapterIndex - 1];
  const isLastChapter = chapterIndex === chapters.length - 1;

  const rampUp = previousChapter
    ? interpolate(frame, [previousChapter.switchStart, previousChapter.switchEnd], [DIM_OPACITY, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  const rampDown = isLastChapter
    ? 1
    : interpolate(frame, [chapter.switchStart, chapter.switchEnd], [1, DIM_OPACITY], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  return Math.min(rampUp, rampDown);
};

export const TableOfContents: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Flatten every parent's children, in order, keeping track of which chapter
  // (parent) each one belongs to.
  const flatChildren = MAIN_ITEMS.flatMap((parent, parentIndex) =>
    (parent.children ?? []).map((label, childIndex) => ({ label, parentIndex, childIndex })),
  );

  const children = flatChildren.map((child) => {
    const chapter = chapters.find((c) => c.parentIndex === child.parentIndex);
    const startFrame = (chapter?.insertStart ?? INSERT_START) + child.childIndex * INSERT_STEP;

    const rawProgress = spring({
      fps,
      frame: frame - startFrame,
      config: { damping: 14, mass: 0.9, stiffness: 120 },
    });
    const progress = interpolate(rawProgress, [0, 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const x = interpolate(progress, [0, 1], [X_SUB - 260, X_SUB]);
    const revealOpacity = interpolate(progress, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
    const opacity = revealOpacity * parentActiveOpacity(child.parentIndex, frame);

    return { ...child, x, opacity, progress };
  });

  // How much a given parent (by index) has been pushed down by children
  // belonging to parents above it.
  const pushForParent = (parentIndex: number) =>
    children
      .filter((child) => child.parentIndex < parentIndex)
      .reduce((sum, child) => sum + child.progress * SUB_OFFSET, 0);

  const parentTops = MAIN_ITEMS.map(
    (_, index) => Y0 + index * MAIN_ROW_HEIGHT + pushForParent(index),
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        fontFamily: BRAND_FONTS.primary,
      }}
    >
      {MAIN_ITEMS.map((parent, index) => {
        const entrance = spring({
          fps,
          frame: frame - (FADE_START + index * FADE_STEP),
          config: { damping: 200, stiffness: 120, mass: 0.8 },
        });
        const entranceOpacity = interpolate(entrance, [0, 1], [0, 1], {
          extrapolateRight: "clamp",
        });
        const rise = interpolate(entrance, [0, 1], [24, 0], { extrapolateRight: "clamp" });

        const opacity = entranceOpacity * parentActiveOpacity(index, frame);

        return (
          <div
            key={parent.label}
            style={{
              position: "absolute",
              left: X_MAIN,
              top: parentTops[index],
              opacity,
              transform: `translateY(${rise}px)`,
              fontSize: 68,
              fontWeight: 700,
              letterSpacing: 0.5,
              color: BRAND_COLORS.yellow,
              textShadow: ITEM_SHADOW,
            }}
          >
            {parent.label}
          </div>
        );
      })}

      {children.map((child) => (
        <div
          key={child.label}
          style={{
            position: "absolute",
            left: child.x,
            top: parentTops[child.parentIndex] + SUB_OFFSET * (child.childIndex + 1),
            opacity: child.opacity,
            fontFamily: BRAND_FONTS.secondary,
            fontSize: 46,
            fontWeight: 600,
            letterSpacing: 0.5,
            color: BRAND_COLORS.pink,
            textShadow: ITEM_SHADOW,
          }}
        >
          {child.label}
        </div>
      ))}
    </AbsoluteFill>
  );
};

const FINAL_HOLD_FRAMES = 50;
const TAIL_FRAMES = 20;

export const calculateMetadata = async () => {
  return {
    fps: 30,
    durationInFrames: TABLE_OF_CONTENTS_END_FRAME + FINAL_HOLD_FRAMES + TAIL_FRAMES,
    width: 1920,
    height: 1080,
    defaultCodec: "prores" as const,
    defaultVideoImageFormat: "png" as const,
    defaultPixelFormat: "yuva444p10le" as const,
    defaultProResProfile: "4444" as const,
  } as const;
};
