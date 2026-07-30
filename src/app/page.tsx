"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import ShortsWorkflow from "./workflow/page";
import VideoGenerator from "./video-generator/page";

type TileId = "workflow" | "videoGenerator";

type Tile = {
  id: TileId;
  label: string;
  description: string;
  disabled?: boolean;
};

const TILES: Tile[] = [
  {
    id: "workflow",
    label: "Shorts Workflow",
    description: "Upload a video, create a project, and run the workflow.",
  },
  {
    id: "videoGenerator",
    label: "Video Generator",
    description: "Generate videos from a prompt.",
  },
];

// Deterministic PRNG (mulberry32) so the starfield renders identically on the
// server and the client — Math.random() here would cause a hydration mismatch.
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DOT_COUNT = 180;
const rand = mulberry32(1337);
const DOTS = Array.from({ length: DOT_COUNT }, () => ({
  left: `${(rand() * 100).toFixed(3)}%`,
  top: `${(rand() * 100).toFixed(3)}%`,
  size: 1 + rand() * 1.6,
  opacity: 0.12 + rand() * 0.35,
}));

// Keep this in sync with the panel's `duration-500` Tailwind class below.
const PANEL_TRANSITION_MS = 500;

const Home = () => {
  const [selected, setSelected] = useState<TileId | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);

  useEffect(() => {
    if (!selected) {
      setPanelVisible(false);
      return;
    }
    // Two rAFs: the first lets the browser paint the freshly-mounted panel in
    // its off-screen starting position, the second then flips it to visible
    // so the CSS transition reliably plays on every open, not just the first.
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => setPanelVisible(true));
    });
    return () => {
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
    };
  }, [selected]);

  const handleClose = () => {
    setPanelVisible(false);
    // Don't rely solely on the transition's `transitionend` event to unmount
    // the panel — it can fail to fire (e.g. reduced-motion settings zeroing
    // the transition duration), which would leave `selected` stuck and the
    // panel unable to reopen. A timeout guarantees it always resets.
    window.setTimeout(() => setSelected(null), PANEL_TRANSITION_MS);
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-0">
        {DOTS.map((dot, index) => (
          <span
            key={index}
            className="absolute rounded-full bg-white"
            style={{
              left: dot.left,
              top: dot.top,
              width: dot.size,
              height: dot.size,
              opacity: dot.opacity,
            }}
          />
        ))}
      </div>

      <div
        className={cn(
          "fixed inset-x-0 top-16 z-10 flex justify-center gap-8 px-6 transition-transform duration-500 ease-out",
          // Resting state (nothing open) sits vertically centered; once the
          // panel rises, this shifts up to sit flush at the top-16 anchor.
          panelVisible ? "translate-y-0" : "translate-y-[calc(50vh-176px)]",
        )}
      >
        {TILES.map((tile) => (
          <button
            key={tile.id}
            type="button"
            disabled={tile.disabled}
            onClick={() => setSelected(tile.id)}
            className={cn(
              "flex h-56 w-72 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-6 text-center transition hover:border-white/30 hover:bg-white/[0.06]",
              tile.disabled && "cursor-not-allowed opacity-40 hover:border-white/10 hover:bg-white/[0.03]",
              selected === tile.id && "border-white/30 bg-white/[0.06]",
            )}
          >
            <span className="text-lg font-semibold text-white">{tile.label}</span>
            <span className="text-sm text-white/50">{tile.description}</span>
          </button>
        ))}
      </div>

      {selected ? (
        <div
          className={cn(
            "fixed inset-x-6 bottom-6 top-[300px] z-20 overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm transition-transform duration-500 ease-out",
            panelVisible ? "translate-y-0" : "translate-y-[120%]",
          )}
        >
          <div className="sticky top-0 z-30 flex justify-end bg-gradient-to-b from-black/40 to-transparent p-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs text-white/70 backdrop-blur hover:text-white"
            >
              Close
            </button>
          </div>
          {selected === "workflow" ? <ShortsWorkflow /> : null}
          {selected === "videoGenerator" ? <VideoGenerator /> : null}
        </div>
      ) : null}
    </main>
  );
};

export default Home;
