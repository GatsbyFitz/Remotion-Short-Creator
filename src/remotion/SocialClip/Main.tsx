import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { Video } from "@remotion/media";
import type { Caption } from "@remotion/captions";
import { ALL_FORMATS, Input, UrlSource } from "mediabunny";
import { BRAND_COLORS } from "../theme";
import { Subtitles } from "./Subtitles";

// One continuous stretch of a project's source video, at the source's own
// aspect ratio, with burned-in subtitles. Unlike the overlay graphics this is a
// finished, opaque video, so it renders as h264 rather than ProRes 4444.
type Props = {
  project: string;
  // Seconds into the source video.
  start: number;
  end: number;
  // Captured at upload; absent for older projects, which are probed instead.
  sourceAspectRatio?: number;
  outName?: string;
};

const FPS = 30;

// The composition's long edge. The project renders at 2x (remotion.config.ts),
// so a landscape clip comes out at 3840 wide unless rendered with --scale=1.
const LONG_EDGE_PX = 1920;

const DEFAULT_SOURCE_ASPECT_RATIO = 16 / 9;

// Short fades at each end so the cut doesn't pop mid-sound.
const AUDIO_FADE_FRAMES = 6;

const edgeFadeVolume = (frame: number, durationInFrames: number) => {
  const fadeFrames = Math.max(1, Math.min(AUDIO_FADE_FRAMES, Math.floor(durationInFrames / 2)));

  return Math.min(
    interpolate(frame, [0, fadeFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    interpolate(frame, [durationInFrames - fadeFrames, durationInFrames], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
};

export const SocialClip: React.FC<Props> = ({ project, start, end }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading captions for <SocialClip>"));

  const fetchCaptions = useCallback(async () => {
    try {
      const response = await fetch(staticFile(`projects/${project}/video-captions.json`));
      if (!response.ok) {
        throw new Error(`Failed to load captions for ${project}: ${response.status} ${response.statusText}`);
      }
      setCaptions(await response.json());
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [continueRender, cancelRender, handle, project]);

  useEffect(() => {
    fetchCaptions();
  }, [fetchCaptions]);

  // Filtered and re-timed here rather than stored per clip, so a hand-edited
  // start/end in clips.json can never leave the subtitles out of sync.
  const clipCaptions = useMemo(() => {
    const clipStartMs = start * 1000;
    const clipEndMs = end * 1000;

    return (captions ?? [])
      .filter((c) => c.endMs > clipStartMs && c.startMs < clipEndMs)
      .map((c) => ({
        ...c,
        startMs: Math.max(0, c.startMs - clipStartMs),
        endMs: Math.min(clipEndMs, c.endMs) - clipStartMs,
        timestampMs: c.timestampMs === null ? null : c.timestampMs - clipStartMs,
      }));
  }, [captions, start, end]);

  const trimBefore = Math.round(start * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND_COLORS.black }}>
      <Video
        src={staticFile(`projects/${project}/video.mp4`)}
        trimBefore={trimBefore}
        trimAfter={trimBefore + durationInFrames}
        volume={(f) => edgeFadeVolume(f, durationInFrames)}
        // The composition already has the source's aspect ratio, so cover only
        // trims the sub-pixel difference from rounding to even dimensions.
        objectFit="cover"
        style={{ width: "100%", height: "100%" }}
      />
      <Subtitles captions={clipCaptions} />
    </AbsoluteFill>
  );
};

const probeAspectRatio = async (src: string): Promise<number | null> => {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new UrlSource(src, { getRetryDelay: () => null }),
  });

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || track.displayWidth <= 0 || track.displayHeight <= 0) {
      return null;
    }
    return track.displayWidth / track.displayHeight;
  } finally {
    input.dispose();
  }
};

// h264 needs even dimensions.
const toEven = (value: number) => Math.max(2, Math.round(value / 2) * 2);

export const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const start = Number(props.start);
  const end = Number(props.end);

  let aspectRatio =
    typeof props.sourceAspectRatio === "number" && props.sourceAspectRatio > 0
      ? props.sourceAspectRatio
      : null;

  if (aspectRatio === null) {
    aspectRatio = await probeAspectRatio(staticFile(`projects/${props.project}/video.mp4`)).catch(
      (error: unknown) => {
        console.warn(`Couldn't read ${props.project}'s video dimensions, assuming 16:9:`, error);
        return null;
      },
    );
  }

  const ratio = aspectRatio ?? DEFAULT_SOURCE_ASPECT_RATIO;
  const width = ratio >= 1 ? LONG_EDGE_PX : toEven(LONG_EDGE_PX * ratio);
  const height = ratio >= 1 ? toEven(LONG_EDGE_PX / ratio) : LONG_EDGE_PX;

  return {
    props: { ...props, start, end },
    fps: FPS,
    width,
    height,
    durationInFrames: Math.max(1, Math.round((end - start) * FPS)),
    defaultCodec: "h264" as const,
    ...(props.outName ? { defaultOutName: props.outName } : {}),
  };
};
