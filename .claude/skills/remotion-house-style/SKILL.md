---
name: remotion-house-style
description: Create new Remotion compositions that match this project's established visual style — brand colors/fonts, transparent overlay exports, animation conventions, and file/registration structure. Use whenever asked to build a new visual or graphic composition for this channel, regardless of what the composition depicts.
metadata:
  tags: remotion, style-guide, brand, animation, design-system
---

## When to use

Whenever asked to build a new Remotion composition/graphic for this project (list reveals, gauges, timelines, counters, block builds, etc.) that should look and animate consistently with the existing ones. Pair with the `remotion-best-practices` skill for general Remotion API knowledge (fonts, captions, ffmpeg, sequencing) — this skill covers this project's specific design system and conventions, not generic Remotion usage.

## Brand system

Always import from `src/remotion/theme.ts` rather than hardcoding hex values or font names:

- `BRAND_COLORS`: black `#000000`, pink `#FF37A1`, yellow `#E1FF62`, textPrimary black, textSecondary `rgba(0,0,0,0.7)`, textLight white, trackLine `rgba(255,55,161,0.15)`
- `BRAND_FONTS`: `primary` = "baga" (titles/headlines, semibold weight), `secondary` = "le-havre-rounded" (body/labels, lighter weight), `tertiary` = "Pollen" (accents/special emphasis)

Pink-to-yellow gradients (`linear-gradient(90deg, ${BRAND_COLORS.pink}, ${BRAND_COLORS.yellow})`) are a recurring accent for underlines, progress fills, and gauge arcs.

## File & folder conventions

- One composition per folder: `src/remotion/<ComponentName>/Main.tsx`
- Export the component **and** an async `calculateMetadata` function from the same file
- Component names are plain nouns describing the visual — PascalCase, no "Composition" suffix (`PushUpTypes`, `MaxThreshold80`, `TwoYearTimeline`, `PriorityList`)

## Export / canvas conventions

Existing compositions render as **transparent overlays** meant to sit on top of real footage, not standalone videos. Transparency is the default preference for every new composition unless told otherwise:

- No solid `backgroundColor` on the outer `AbsoluteFill` — either omit `backgroundColor` entirely or set it explicitly to `"transparent"` for self-documentation
- `calculateMetadata` should return `fps: 30`, `width: 1920`, `height: 1080` (unless told otherwise), plus:
  ```ts
  defaultCodec: "prores" as const,
  defaultVideoImageFormat: "png" as const,
  defaultPixelFormat: "yuva444p10le" as const,
  defaultProResProfile: "4444" as const,
  ```
  This is what preserves the alpha channel for overlay use — don't drop it.
- Choose text/shape colors assuming they'll sit over arbitrary video, not a fixed background: black (as in `PushUpTypes`, `MaxThreshold80`) reads on light footage, light/yellow (as in `TwoYearTimeline`) reads on dark footage. Ask which is likely if it's not obvious from the brief.
- **Known gotcha:** `styles/global.css` (shared with the Next.js app via `src/app/layout.tsx`) applies a solid `body { @apply bg-background }`. It's also imported by `src/remotion/index.ts`, so without a fix it bleeds an opaque background through every composition's transparent `AbsoluteFill`, both in Studio preview and in actual rendered frames. This is neutralized once, project-wide, via `src/remotion/transparent-canvas.css` (imported after `global.css` in `src/remotion/index.ts`), which forces `html, body { background: transparent !important; }` scoped to the Remotion bundle only — it does not touch the Next.js app's styling. Don't edit `global.css` itself to fix transparency issues; that file is shared and its body background is intentional for the Next app.

## Animation conventions

- CSS transitions/animations and Tailwind animation classes are forbidden — everything is driven by `useCurrentFrame()` with `interpolate()` / `spring()`
- Typical easing: `Easing.bezier(0.16, 1, 0.3, 1)` for a snappy-decelerate entrance; `Easing.inOut(Easing.cubic)` for continuous scroll/roll motion
- Typical spring config for staggered card/row entrances: `{ damping: 200, stiffness: 120, mass: 0.8 }`, staggered by offsetting `frame - baseDelay - index * stepDelay`
- Common opener: a title/intro fade + rise (opacity 0→1, `translateY` ~18-20px→0) over the first ~15-28 frames before the main animation begins

## Reusable motifs — pick based on the ask

1. **Staggered card/list reveal** — items spring in one after another, side by side or stacked. See `src/remotion/PushUpTypes/Main.tsx`.
2. **Progress bar / timeline** — SVG line with a moving marker and tick labels. See `src/remotion/TwoYearTimeline/Main.tsx`.
3. **Radial gauge / threshold ring** — SVG arc with gradient stroke filling toward a value. See `src/remotion/MaxThreshold80/Main.tsx`, `src/remotion/Gauge/Main.tsx`.
4. **Block build-up** — counting/building blocks. See `src/remotion/PushUp100BlocksBuild`, `src/remotion/BlocksTimesThree`, `src/remotion/ThreeBlocksReveal`.
5. **Rolling/rolodex list scan** — a long list scrolls through a masked viewport, the centered item is highlighted (e.g. color shift + scale), and it lands on a final item. Good for "sequence through N items until you reach X" briefs, works well for lists too long to reveal all at once (10-100+ items). See `src/remotion/PriorityList/Main.tsx` for a full worked example (100-item scroll with a `mask-image` fade at the viewport edges, `Easing.inOut(Easing.cubic)` for the roll, and a settle-pulse on the final item).
6. **Traveling highlight bar** — a static stacked list where a highlight pill/bar moves down to the active row instead of the whole list scrolling. Better fit than the rolodex for short lists (roughly ≤8 items) where every item should stay visible on screen at once.

When the brief is a list that sequences to a final/bottom item, ask (or infer from list length) whether a traveling highlight bar (short list, everything visible) or a rolodex scroll (long list, masked viewport) fits better.

## Registering a new composition

In `src/remotion/Root.tsx`:

1. Import the component and its `calculateMetadata`, aliasing the latter (e.g. `calculateMetadata as calculate<Name>Metadata`) since every composition file exports a function with that same name
2. Add a `<Composition>` inside the `<Folder name="Visuals">` block with `id`, `component`, `width`, `height`, `fps`, a `durationInFrames` that matches what `calculateMetadata` will compute (this is only the Studio's initial guess before `calculateMetadata` resolves — keep it in sync so the two don't disagree), and `calculateMetadata`

## Sanity check

Render one or two still frames to confirm layout and timing before calling it done:

```bash
npx remotion still <composition-id> --scale=0.5 --frame=<n> out.png
```

Check a frame partway through the animation and a frame at the final held state (e.g. the last item, the completed gauge).
