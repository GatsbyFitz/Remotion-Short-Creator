import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND_COLORS } from "../theme";

const GLYPHS: Record<string, string[]> = {
  "0": [
    "01110",
    "10001",
    "10011",
    "10101",
    "11001",
    "10001",
    "01110",
  ],
  "1": [
    "00100",
    "01100",
    "00100",
    "00100",
    "00100",
    "00100",
    "01110",
  ],
  P: [
    "11110",
    "10001",
    "10001",
    "11110",
    "10000",
    "10000",
    "10000",
  ],
  U: [
    "10001",
    "10001",
    "10001",
    "10001",
    "10001",
    "10001",
    "01110",
  ],
  S: [
    "01111",
    "10000",
    "10000",
    "01110",
    "00001",
    "00001",
    "11110",
  ],
  H: [
    "10001",
    "10001",
    "10001",
    "11111",
    "10001",
    "10001",
    "10001",
  ],
  " ": [
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
  ],
};

type Cell = {
  row: number;
  col: number;
  order: number;
  line: "top" | "bottom";
  buildOrder?: number;
};

const lineToCells = (
  line: string,
  startRow: number,
  lineName: "top" | "bottom",
): Cell[] => {
  let cursorCol = 0;
  let order = 0;
  const cells: Cell[] = [];

  for (const letter of line) {
    const glyph = GLYPHS[letter];

    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < glyph[row].length; col++) {
        if (glyph[row][col] === "1") {
          cells.push({
            row: startRow + row,
            col: cursorCol + col,
            order,
            line: lineName,
          });
          order += 1;
        }
      }
    }

    cursorCol += glyph[0].length + 1;
  }

  return cells;
};

const TOP_LINE = "100";
const BOTTOM_LINE = "PUSH UPS";
const TOP_ROWS = 7;
const LINE_GAP_ROWS = 2;
const BLOCK_SIZE = 28;
const BLOCK_GAP = 8;
const PITCH = BLOCK_SIZE + BLOCK_GAP;

const topCells = lineToCells(TOP_LINE, 0, "top");
const bottomCells = lineToCells(BOTTOM_LINE, TOP_ROWS + LINE_GAP_ROWS, "bottom");
const cells = [...topCells, ...bottomCells].map((cell, index) => ({
  ...cell,
  order: index,
}));

const cellsWithBuildOrder = [...cells]
  .sort((a, b) => {
    if (a.row !== b.row) {
      return b.row - a.row;
    }

    return a.col - b.col;
  })
  .map((cell, index) => ({
    ...cell,
    buildOrder: index,
  }));

const topMaxCol = Math.max(...topCells.map((cell) => cell.col));
const bottomMaxCol = Math.max(...bottomCells.map((cell) => cell.col));
const maxRow = Math.max(...cells.map((cell) => cell.row));
const topWidth = (topMaxCol + 1) * PITCH;
const bottomWidth = (bottomMaxCol + 1) * PITCH;
const matrixHeight = (maxRow + 1) * PITCH;

export const calculateMetadata = async () => {
  return {
    fps: 30,
    durationInFrames: 300,
    width: 1920,
    height: 1080,
    defaultCodec: "prores" as const,
    defaultVideoImageFormat: "png" as const,
    defaultPixelFormat: "yuva444p10le" as const,
    defaultProResProfile: "4444" as const,
  } as const;
};

export const PushUp100BlocksBuild: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const buildOpacity = interpolate(frame, [0, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {cellsWithBuildOrder.map((cell, index) => {
          const currentLineWidth = cell.line === "top" ? topWidth : bottomWidth;
          const targetX = width / 2 - currentLineWidth / 2 + cell.col * PITCH;
          const targetY = height / 2 - matrixHeight / 2 + cell.row * PITCH;

          const entryFrame = 40 + (cell.buildOrder ?? index) * 0.56;
          const progress = spring({
            fps,
            frame: frame - entryFrame,
            config: {
              damping: 200,
              stiffness: 120,
              mass: 0.8,
            },
          });

          const lane = index % 12;
          const spawnX = targetX;
          const spawnY = targetY + 420 + lane * 28;

          const blockX = interpolate(progress, [0, 1], [spawnX, targetX], {
            extrapolateRight: "clamp",
          });
          const blockY = interpolate(progress, [0, 1], [spawnY, targetY], {
            extrapolateRight: "clamp",
          });

          const blockOpacity = interpolate(progress, [0, 1], [0, 1], {
            extrapolateRight: "clamp",
          });

          const isAccent = (cell.row + cell.col) % 9 === 0;
          const blockColor = isAccent ? BRAND_COLORS.pink : BRAND_COLORS.yellow;

          return (
            <rect
              key={`cell-${index}`}
              x={blockX}
              y={blockY}
              width={BLOCK_SIZE}
              height={BLOCK_SIZE}
              rx={8}
              fill={blockColor}
              opacity={blockOpacity * buildOpacity}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
