import { z } from "zod";
export const COMP_NAME = "MyComp";

// Stable id of the headless render target registered in src/remotion/Root.tsx.
// The per-short compositions are only registered after the Studio fetches the
// project list over HTTP, so a server-side render targets this one instead and
// passes { segments, project } as inputProps.
export const SHORT_CREATOR_COMP_ID = "ShortCreator";

export const CompositionProps = z.object({
  title: z.string(),
});

export const defaultMyCompProps: z.infer<typeof CompositionProps> = {
  title: "Vercel and Remotion",
};

export const DURATION_IN_FRAMES = 200;
export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
export const VIDEO_FPS = 30;
