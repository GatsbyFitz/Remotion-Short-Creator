import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";

// Mirrors ReelShot in reelsWorkflow/steps/reelsShared.ts. Declared here rather
// than imported so the Remotion bundle never pulls in the server-side module.
export type ReelShot = {
  mediaId: string;
  file: string;
  kind: "photo" | "video";
  width: number;
  height: number;
  beats: number;
  videoStart: number;
  loop: boolean;
  fit: "cover" | "blur";
  focusX: number;
  motion: "none" | "zoomIn" | "zoomOut" | "panLeft" | "panRight";
  entrance: "cut" | "punch" | "flash";
  text: string | null;
  textPosition: "top" | "center" | "bottom";
};

// Slow moves over a shot. The pans scale up a little first so the edge of the
// media never slides into view.
const ZOOM_AMOUNT = 0.1;
const PAN_SCALE = 1.08;
const PAN_DISTANCE = 0.03;

const PUNCH_FROM_SCALE = 1.15;
const PUNCH_FRAMES = 8;
const FLASH_FRAMES = 6;

// Laid out by hand rather than with object-fit so the same maths positions
// photos and videos alike, and so focusX can choose which part of an over-wide
// image survives the crop to vertical.
const placeMedia = (
  media: { width: number; height: number },
  frame: { width: number; height: number },
  mode: "cover" | "contain",
  focusX: number,
) => {
  const scale =
    mode === "cover"
      ? Math.max(frame.width / media.width, frame.height / media.height)
      : Math.min(frame.width / media.width, frame.height / media.height);
  const width = media.width * scale;
  const height = media.height * scale;

  return {
    position: "absolute" as const,
    width,
    height,
    left: (frame.width - width) * (mode === "cover" ? focusX : 0.5),
    top: (frame.height - height) / 2,
  };
};

const ShotMedia: React.FC<{ project: string; shot: ReelShot; style: React.CSSProperties }> = ({
  project,
  shot,
  style,
}) => {
  const { fps } = useVideoConfig();
  const src = staticFile(`reels/${project}/${shot.file}`);

  if (shot.kind === "video") {
    return (
      <div style={style}>
        <Video
          src={src}
          // The sound is added in Instagram; a clip's own audio would clash.
          muted
          loop={shot.loop}
          trimBefore={Math.round(shot.videoStart * fps)}
          objectFit="fill"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  }

  // The bundle imports styles/global.css, whose Tailwind base clamps images to
  // max-width: 100%. A cover-cropped landscape photo is deliberately wider than
  // the frame, and the clamp would squeeze it off-screen to the left.
  return <Img src={src} style={{ ...style, objectFit: "fill", maxWidth: "none", maxHeight: "none" }} />;
};

export const Shot: React.FC<{ project: string; shot: ReelShot }> = ({ project, shot }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const motion = {
    none: { scale: 1, x: 0 },
    zoomIn: { scale: 1 + ZOOM_AMOUNT * progress, x: 0 },
    zoomOut: { scale: 1 + ZOOM_AMOUNT * (1 - progress), x: 0 },
    panLeft: { scale: PAN_SCALE, x: interpolate(progress, [0, 1], [PAN_DISTANCE, -PAN_DISTANCE]) * width },
    panRight: { scale: PAN_SCALE, x: interpolate(progress, [0, 1], [-PAN_DISTANCE, PAN_DISTANCE]) * width },
  }[shot.motion];

  const punch =
    shot.entrance === "punch"
      ? interpolate(spring({ frame, fps, config: { damping: 200 }, durationInFrames: PUNCH_FRAMES }), [0, 1], [PUNCH_FROM_SCALE, 1])
      : 1;

  const flashOpacity =
    shot.entrance === "flash"
      ? interpolate(frame, [0, FLASH_FRAMES], [0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 0;

  const frameSize = { width, height };
  const mediaSize = { width: shot.width, height: shot.height };

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {shot.fit === "blur" ? (
        // The same media, cropped to fill and blurred, behind the full-width copy.
        <AbsoluteFill style={{ filter: "blur(40px) brightness(0.55)", transform: "scale(1.15)" }}>
          <ShotMedia project={project} shot={shot} style={placeMedia(mediaSize, frameSize, "cover", 0.5)} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ transform: `translateX(${motion.x}px) scale(${motion.scale * punch})` }}>
        <ShotMedia
          project={project}
          shot={shot}
          style={placeMedia(mediaSize, frameSize, shot.fit === "blur" ? "contain" : "cover", shot.focusX)}
        />
      </AbsoluteFill>
      {flashOpacity > 0 ? <AbsoluteFill style={{ backgroundColor: "#ffffff", opacity: flashOpacity }} /> : null}
    </AbsoluteFill>
  );
};
