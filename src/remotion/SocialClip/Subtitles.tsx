import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption, TikTokPage, TikTokToken } from "@remotion/captions";
import { BRAND_COLORS, BRAND_FONTS } from "../theme";
import { captionPopStyle } from "../captionPop";

// Words starting within this long of each other share a page. A little looser
// than the shorts' 500ms, since a landscape frame has room for a few more words.
const COMBINE_TOKENS_WITHIN_MS = 800;

// A page otherwise stays up until the next one starts, which leaves stale text
// sitting over the footage through every pause. Hold it this long after its
// last word instead.
const PAGE_HOLD_MS = 600;

const SENTENCE_END = /[.?!]["')\]]*$/;

// createTikTokStyleCaptions groups purely on timing, so a page can run on into
// the next sentence ("why not? And"). Break after sentence-ending punctuation so
// every page reads as one thought.
const splitAtSentenceEnds = (pages: TikTokPage[]): TikTokPage[] => {
  const pieces: TikTokToken[][] = [];

  for (const page of pages) {
    let current: TikTokToken[] = [];
    for (const token of page.tokens) {
      current.push(token);
      if (SENTENCE_END.test(token.text.trim())) {
        pieces.push(current);
        current = [];
      }
    }
    if (current.length > 0) {
      pieces.push(current);
    }
  }

  const lastPage = pages[pages.length - 1];
  const lastEndMs = lastPage ? lastPage.startMs + lastPage.durationMs : 0;

  return pieces.map((tokens, index) => {
    const trimmed = tokens.map((token, i) => (i === 0 ? { ...token, text: token.text.trimStart() } : token));
    const startMs = trimmed[0].fromMs;
    const nextStartMs = pieces[index + 1]?.[0].fromMs ?? lastEndMs;

    return {
      text: trimmed.map((token) => token.text).join(""),
      startMs,
      tokens: trimmed,
      durationMs: Math.max(0, nextStartMs - startMs),
    };
  });
};

// Captions are expected clip-relative: 0ms is the clip's first frame.
export const Subtitles: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const { fps } = useVideoConfig();

  const pages = useMemo(
    () =>
      splitAtSentenceEnds(
        createTikTokStyleCaptions({
          captions,
          combineTokensWithinMilliseconds: COMBINE_TOKENS_WITHIN_MS,
        }).pages,
      ),
    [captions],
  );

  return (
    <AbsoluteFill>
      {pages.map((page, index) => {
        const lastToken = page.tokens[page.tokens.length - 1];
        if (!lastToken) {
          return null;
        }

        // durationMs already runs exactly to the next page's start, so taking
        // the min keeps pages from overlapping.
        const endMs = Math.min(page.startMs + page.durationMs, lastToken.toMs + PAGE_HOLD_MS);
        const from = Math.round((page.startMs / 1000) * fps);
        const durationInFrames = Math.round((endMs / 1000) * fps) - from;

        if (durationInFrames <= 0) {
          return null;
        }

        return (
          <Sequence key={`${page.startMs}-${index}`} from={from} durationInFrames={durationInFrames}>
            <SubtitlePage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const SubtitlePage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Frame is relative to the page's own Sequence.
  const absoluteTimeMs = page.startMs + (frame / fps) * 1000;

  // Sized off the short edge so a portrait clip gets the same text size as a
  // landscape one, and held higher in portrait, where platform UI covers the
  // bottom of the frame.
  const fontSize = Math.round(Math.min(width, height) * 0.075);
  const bottomInset = height * (height > width ? 0.22 : 0.09);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: bottomInset,
      }}
    >
      <div
        style={{
          maxWidth: width * 0.86,
          fontFamily: BRAND_FONTS.primary,
          fontWeight: 600,
          fontSize,
          lineHeight: 1.1,
          textAlign: "center",
          // Tokens carry their own leading spaces; pre-wrap keeps them while
          // still letting a long page wrap inside maxWidth.
          whiteSpace: "pre-wrap",
          // Frame is relative to this page's own Sequence, so it pops on entry.
          ...captionPopStyle(frame, fps, fontSize),
        }}
      >
        {page.tokens.map((token, index) => {
          const isActive = token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs;

          return (
            <span
              key={`${token.fromMs}-${index}`}
              style={{
                color: isActive ? BRAND_COLORS.pink : BRAND_COLORS.yellow,
                WebkitTextStroke: `${Math.max(2, Math.round(fontSize * 0.05))}px ${BRAND_COLORS.black}`,
                paintOrder: "stroke fill",
                textShadow: `0 ${Math.round(fontSize * 0.06)}px ${Math.round(fontSize * 0.14)}px rgba(0,0,0,0.55)`,
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
