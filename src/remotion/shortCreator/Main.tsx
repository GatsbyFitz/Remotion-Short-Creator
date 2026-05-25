// src/remotion/shortCreator/Main.tsx
import React, { useCallback, useCallback, useEffect, useMemo, useState } from "react";
import { useVideoConfig, staticFile, OffthreadVideo, useDelayRender, cancelRender, continueRender, AbsoluteFill, useCurrentFrame } from "remotion";
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import { fade } from "@remotion/transitions/fade";
import type { CalculateMetadataFunction } from "remotion";
import {openAiWhisperApiToCaptions} from '@remotion/openai-whisper';
import {createTikTokStyleCaptions} from '@remotion/captions';
import type {Caption} from '@remotion/captions';

type Segment = { start: number; end: number };



export const Stitcher: React.FC<{ segments: Segment[] }> = ({ segments }) => {
  const { fps } = useVideoConfig();
  const src = staticFile("video.mp4");
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender());

  const SWITCH_CAPTIONS_EVERY_MS = 3000;

  const fetchCaptions = useCallback(async () => {
    try {
      const res = await fetch(staticFile("video-transcript.json")); // public file
      const data = await res.json();
      console.log("Fetched transcript data:", data);

      const transcription = data.responses?.[0]?.body ?? null;
      if (!transcription) throw new Error('Missing Whisper body');

      const {captions} = openAiWhisperApiToCaptions({transcription});
      console.log("Formatted captions:", captions);
      setCaptions(captions);
      continueRender(handle);
    } catch (err) {
      console.error("Error fetching captions:", err);
      cancelRender(handle);
    }
  },[continueRender, cancelRender, handle]);

  useEffect(() => {
    fetchCaptions();
  }, [fetchCaptions]);


  const {pages} = useMemo(() => {
  return createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: 1200,
  });
}, [captions]);

  console.log("Generated caption pages:", pages);


  return (
    <TransitionSeries>
      {segments.map((seg, i) => {
        const trimBefore = Math.floor(seg.start * fps);
        const trimAfter = Math.floor(seg.end * fps);
        const durFrames = Math.max(1, trimAfter - trimBefore);

        const seq = ( <TransitionSeries.Sequence key={i} durationInFrames={durFrames}>
            <OffthreadVideo
              src={src}
              trimBefore={trimBefore}
              trimAfter={trimAfter}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
            />
            {pages.length > 0 &&
              pages.map((page, idx) => {
                // page.startMs is absolute ms within video; offset into this segment:
                const pageStartRelMs = page.startMs - seg.start * 1000;
                const pageEndRelMs = (pages[idx + 1]?.startMs ?? (page.startMs + SWITCH_CAPTIONS_EVERY_MS)) - seg.start * 1000;
                // skip pages that don't overlap this segment
                if (pageEndRelMs <= 0 || pageStartRelMs >= (durFrames / fps) * 1000) return null;
                const startFrame = Math.max(0, Math.floor((pageStartRelMs / 1000) * fps));
                const endFrame = Math.min(durFrames, Math.ceil((pageEndRelMs / 1000) * fps));
                return endFrame > startFrame ? (
                  <CaptionPage key={`cap-${i}-${idx}`} page={page} startFrameInSequence={startFrame} />
                ) : null;
              })
            }
          </TransitionSeries.Sequence>)

          if (i < segments.length - 1) {
            return [
              seq,
              <TransitionSeries.Transition
                key={`trans-${i}`}
                presentation={fade()}
                timing={linearTiming({ durationInFrames: 15 })}
              />,
            ];
          }

          return [seq];
      })}
    </TransitionSeries>
  );
};

export const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const fps = 30;
  const normalized = (props.segments ?? [])
    .map((s) => ({ start: Number(s.start), end: Number(s.end) }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);

  const totalFrames = Math.max(
    1,
    normalized.reduce((acc, s) => acc + Math.max(1, Math.round((s.end - s.start) * fps)), 0)
  );

  return {
    props: { ...props, segments: normalized },
    fps,
    durationInFrames: totalFrames,
  };
};


const HIGHLIGHT_COLOR = '#39E508';

const CaptionPage: React.FC<{page: TikTokPage; startFrameInSequence: number}> = ({page, startFrameInSequence}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const frameInPage = frame - startFrameInSequence;
  const absoluteTimeMs = page.startMs + (frameInPage / fps) * 1000;

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{fontSize: 80, fontWeight: 'bold', textAlign: 'center', whiteSpace: 'pre'}}>
        {page.tokens.map((token) => {
          const isActive = token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs;
          return (
            <span key={token.fromMs} style={{color: isActive ? HIGHLIGHT_COLOR : 'white'}}>
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};