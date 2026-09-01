import "server-only";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  makeCancelSignal,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { SHORT_CREATOR_COMP_ID } from "../../../../types/constants";
import { readEnv } from "../../../lib/env";

export type RenderJobStatus =
  | "queued"
  | "preparing"
  | "rendering"
  | "done"
  | "error"
  | "cancelled";

export type RenderJob = {
  id: string;
  projectId: string;
  shortId: string;
  shortTitle: string;
  status: RenderJobStatus;
  /** 0..1, or null while we have no meaningful number yet. */
  progress: number | null;
  phase: string;
  /** Public URL of the finished file, served from /out. */
  outputUrl?: string;
  outputFile?: string;
  error?: string;
  createdAt: number;
  finishedAt?: number;
};

type Segment = {
  start: number;
  end: number;
  transition?: string;
  segment_purpose?: string;
};

export type RenderRequestInput = {
  projectId: string;
  shortId: string;
  shortTitle: string;
  shortIndex: number;
  segments: Segment[];
};

// Next dev reloads modules on edit, which would drop in-flight jobs and start a
// second bundle. Anchoring state on globalThis keeps one queue per process.
type RendererState = {
  jobs: Map<string, RenderJob>;
  /** Cancel functions for jobs that are currently running. */
  cancels: Map<string, () => void>;
  /**
   * Jobs we asked Remotion to cancel. Remotion signals cancellation by
   * throwing, and its `isUserCancelledRender` helper is not part of the public
   * API, so tracking the intent here avoids both a brittle message match and a
   * reach into internals.
   */
  cancelRequested: Set<string>;
  queue: Promise<void>;
  bundlePromise: Promise<string> | null;
};

const globalForRenderer = globalThis as typeof globalThis & {
  __shortRenderer?: RendererState;
};

const state: RendererState = (globalForRenderer.__shortRenderer ??= {
  jobs: new Map(),
  cancels: new Map(),
  cancelRequested: new Set(),
  queue: Promise.resolve(),
  bundlePromise: null,
});

export const OUT_DIR = path.join(process.cwd(), "out");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const ENTRY_POINT = path.join(process.cwd(), "src", "remotion", "index.ts");

/**
 * Bundling the Remotion project takes ~30-60s, so it is done once per process
 * and reused for every render. Restart the server to pick up composition edits.
 */
function getBundle(onProgress: (progress: number) => void): Promise<string> {
  if (state.bundlePromise) return state.bundlePromise;

  // bundle() needs the public dir to exist even when no project has been
  // uploaded yet, and symlinking it keeps multi-GB source videos out of the
  // bundle output.
  fs.mkdirSync(path.join(PUBLIC_DIR, "projects"), { recursive: true });

  state.bundlePromise = bundle({
    entryPoint: ENTRY_POINT,
    publicDir: PUBLIC_DIR,
    symlinkPublicDir: true,
    // remotion.config.ts only applies to the CLI, so Tailwind has to be wired
    // up explicitly here or every composition renders unstyled.
    webpackOverride: enableTailwind,
    onProgress,
  }).catch((err) => {
    state.bundlePromise = null; // let the next render retry a failed bundle
    throw err;
  });

  return state.bundlePromise;
}

/**
 * Point this at an existing Chrome/Chromium headless shell to skip Remotion's
 * download. Useful in a Docker image that already apt-installs chromium, and
 * required on hosts that cannot reach Remotion's CDN.
 */
const getBrowserExecutable = (): string | null =>
  readEnv("REMOTION_BROWSER_EXECUTABLE") || null;

const parseConcurrency = (): number | null => {
  const raw = readEnv("RENDER_CONCURRENCY");
  if (!raw) return null; // let Remotion size it from the available cores
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

async function runJob(job: RenderJob, input: RenderRequestInput) {
  const update = (patch: Partial<RenderJob>) => {
    Object.assign(job, patch);
  };

  const { cancelSignal, cancel } = makeCancelSignal();
  state.cancels.set(job.id, cancel);
  const browserExecutable = getBrowserExecutable();

  try {
    update({ status: "preparing", phase: "Preparing renderer...", progress: null });

    // On a fresh server the headless browser is not there yet. Downloading it
    // is a one-off, but it is slow enough to be worth reporting. Skipped
    // entirely when a system browser is configured.
    if (!browserExecutable) {
      await ensureBrowser({
        onBrowserDownload: () => ({
          version: null,
          onProgress: ({ percent }) => {
            update({
              phase: "Downloading headless browser (one-off)...",
              progress: percent,
            });
          },
        }),
      });
    }

    update({ phase: "Bundling compositions...", progress: null });
    const serveUrl = await getBundle((progress) => {
      update({ phase: "Bundling compositions...", progress });
    });

    update({ phase: "Selecting composition...", progress: null });
    const inputProps = {
      segments: input.segments,
      project: input.projectId,
    };

    const composition = await selectComposition({
      serveUrl,
      id: SHORT_CREATOR_COMP_ID,
      inputProps,
      browserExecutable,
    });

    fs.mkdirSync(OUT_DIR, { recursive: true });

    // uploadToYoutube finds rendered files by the `ShortCreator-<shortId>-`
    // prefix, so this name has to keep matching the Studio's convention.
    const outputFile = `${SHORT_CREATOR_COMP_ID}-${input.shortId}-${input.shortIndex}.mp4`;
    const outputLocation = path.join(OUT_DIR, outputFile);

    update({ status: "rendering", phase: "Rendering video...", progress: 0 });

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps,
      imageFormat: "jpeg",
      overwrite: true,
      concurrency: parseConcurrency(),
      browserExecutable,
      cancelSignal,
      onProgress: ({ progress, stitchStage }) => {
        update({
          progress,
          phase:
            stitchStage === "muxing" ? "Muxing audio and video..." : "Rendering video...",
        });
      },
    });

    update({
      status: "done",
      phase: "Done",
      progress: 1,
      outputFile,
      outputUrl: `/api/render/file/${encodeURIComponent(outputFile)}`,
      finishedAt: Date.now(),
    });
  } catch (err) {
    const cancelled = state.cancelRequested.has(job.id);
    update({
      status: cancelled ? "cancelled" : "error",
      phase: cancelled ? "Cancelled" : "Failed",
      error: cancelled ? undefined : err instanceof Error ? err.message : String(err),
      finishedAt: Date.now(),
    });
    if (!cancelled) console.error(`[render] job ${job.id} failed:`, err);
  } finally {
    state.cancels.delete(job.id);
    state.cancelRequested.delete(job.id);
  }
}

/**
 * Queues a render. Renders run one at a time — a 2-core VPS cannot usefully
 * run two headless Chrome renders at once, and doing so risks the OOM killer.
 */
export function enqueueRender(input: RenderRequestInput): RenderJob {
  const job: RenderJob = {
    id: randomUUID(),
    projectId: input.projectId,
    shortId: input.shortId,
    shortTitle: input.shortTitle,
    status: "queued",
    progress: null,
    phase: "Queued",
    createdAt: Date.now(),
  };

  state.jobs.set(job.id, job);
  pruneJobs();

  // runJob handles its own failures, but anything it misses must not reject the
  // shared queue promise: an unhandled rejection here takes the whole server
  // down and would also wedge every render queued behind it.
  state.queue = state.queue
    .then(() => {
      // A job cancelled before it reached the front of the queue must not start.
      if (job.status === "cancelled") return;
      return runJob(job, input);
    })
    .catch((err) => {
      console.error(`[render] job ${job.id} crashed outside its handler:`, err);
      if (job.status === "queued" || job.status === "preparing" || job.status === "rendering") {
        job.status = "error";
        job.phase = "Failed";
        job.error = err instanceof Error ? err.message : String(err);
        job.finishedAt = Date.now();
      }
    });

  return job;
}

export function getJob(jobId: string): RenderJob | undefined {
  return state.jobs.get(jobId);
}

export function listJobs(projectId?: string): RenderJob[] {
  const all = [...state.jobs.values()];
  const filtered = projectId ? all.filter((j) => j.projectId === projectId) : all;
  return filtered.sort((a, b) => b.createdAt - a.createdAt);
}

export function cancelJob(jobId: string): boolean {
  const job = state.jobs.get(jobId);
  if (!job) return false;
  if (job.status === "done" || job.status === "error" || job.status === "cancelled") {
    return false;
  }

  const cancel = state.cancels.get(jobId);
  if (cancel) {
    // Already running: ask Remotion to stop, and let runJob record the outcome.
    state.cancelRequested.add(jobId);
    job.phase = "Cancelling...";
    cancel();
  } else {
    // Still queued: mark it so the queue skips it.
    job.status = "cancelled";
    job.phase = "Cancelled";
    job.finishedAt = Date.now();
  }
  return true;
}

/** Keeps the in-memory job list from growing without bound. */
function pruneJobs() {
  const MAX_JOBS = 50;
  if (state.jobs.size <= MAX_JOBS) return;

  const finished = [...state.jobs.values()]
    .filter((j) => j.status === "done" || j.status === "error" || j.status === "cancelled")
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));

  for (const job of finished.slice(0, state.jobs.size - MAX_JOBS)) {
    state.jobs.delete(job.id);
  }
}
