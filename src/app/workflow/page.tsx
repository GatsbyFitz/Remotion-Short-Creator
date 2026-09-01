"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useEffect, useState } from "react";
import type { NextPage } from "next";
import {
  ALL_FORMATS,
  BlobSource,
  Input as BunnyInput, // Aliased to avoid naming conflict with shadcn UI Input
  UrlSource,
  VideoSample,
  VideoSampleSink
} from 'mediabunny';

type Short = {
  id: string;
  title: string;
  description: string;
  youtubeVideoUrl?: string;
  segments: { start: number; end: number; transition?: string; segment_purpose?: string }[];
};

type Project = {
  id: string;
  name: string;
  shorts: Short[];
  renderCount: number;
  uploadedAt: string | null;
  fileSizeBytes: number | null;
  audioFileSizeBytes: number | null;
  frameCount: number | null;
};

type ShortUiState = {
  title?: string;
  description?: string;
  saving?: boolean;
  uploading?: boolean;
  error?: string;
  success?: string;
};

// Mirrors the RenderJob shape returned by /api/render.
type RenderJob = {
  id: string;
  projectId: string;
  shortId: string;
  shortTitle: string;
  status: "queued" | "preparing" | "rendering" | "done" | "error" | "cancelled";
  progress: number | null;
  phase: string;
  outputUrl?: string;
  error?: string;
};

const ACTIVE_RENDER_STATUSES: RenderJob["status"][] = [
  "queued",
  "preparing",
  "rendering",
];

const formatFileSize = (bytes: number | null): string => {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) {
    return "Unknown";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const formattedSize = size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1);
  return `${formattedSize} ${units[unitIndex]}`;
};

const formatUploadedAt = (uploadedAt: string | null): string => {
  if (!uploadedAt) {
    return "Unknown";
  }

  const parsed = new Date(uploadedAt);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

// ==========================================
// MEDIABUNNY EXTRACTION INTERFACE DEFINITIONS
// ==========================================
type Options = {  
  track: {width: number; height: number};  
  container: string;  
  durationInSeconds: number | null;
};

export type ExtractFramesTimestampsInSecondsFn = (options: Options) => Promise<number[]> | number[];

export type ExtractFramesProps = {  
  src: string;  
  timestampsInSeconds: number[] | ExtractFramesTimestampsInSecondsFn;  
  onVideoSample: (sample: VideoSample) => Promise<void> | void;  
  signal?: AbortSignal;
};

export async function extractFrames({src, timestampsInSeconds, onVideoSample, signal}: ExtractFramesProps): Promise<void> {  
  using input = new BunnyInput({    
    formats: ALL_FORMATS,    
    source: new UrlSource(src),  
  });  
  
  const [durationInSeconds, format, videoTrack] = await Promise.all([
    input.computeDuration(), 
    input.getFormat(), 
    input.getPrimaryVideoTrack()
  ]);  
  
  if (!videoTrack) {    
    throw new Error('No video track found in the input');  
  }  
  if (signal?.aborted) {    
    throw new Error('Aborted');  
  }  
  
  const timestamps = typeof timestampsInSeconds === 'function'      
    ? await timestampsInSeconds({          
        track: {            
          width: videoTrack.displayWidth,            
          height: videoTrack.displayHeight,          
        },          
        container: format.name,          
        durationInSeconds,        
      })      
    : timestampsInSeconds;  
    
  if (timestamps.length === 0) {    
    return;  
  }  
  if (signal?.aborted) {    
    throw new Error('Aborted');  
  }  
  
  const sink = new VideoSampleSink(videoTrack);  
  for await (using videoSample of sink.samplesAtTimestamps(timestamps)) {    
    if (signal?.aborted) {      
      break;    
    }    
    if (!videoSample) {      
      continue;    
    }    
    await onVideoSample(videoSample);  
  }
}
// ==========================================

const ShortsWorkflow: NextPage = () => {
  const defaultWorkflowAction = "runShortsWorkflow";
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressBytes, setProgressBytes] = useState(0);
  const [projectActions, setProjectActions] = useState<Record<string, string>>({});
  const [frameProgress, setFrameProgress] = useState("");
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [shortEdits, setShortEdits] = useState<Record<string, ShortUiState>>({});
  const [renderJobs, setRenderJobs] = useState<Record<string, RenderJob>>({});

  const loadProjects = async () => {
    try {
      const response = await fetch("/api/findProjects");
      if (!response.ok) throw new Error("Failed to load projects");
      const data = (await response.json()) as Project[];
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  const createProject = async () => {
    setLoading(true);
    setError("");
    setProgressBytes(0);
    setFrameProgress("");

    if (!file) {
      setError("Please select an MP4 file to upload.");
      setLoading(false);
      return;
    }

    if (!thumbnailFile) {
      setError("Please select a custom thumbnail image before creating the project.");
      setLoading(false);
      return;
    }

    setFrameProgress("Checking video compatibility...");
    {
      using probeInput = new BunnyInput({ formats: ALL_FORMATS, source: new BlobSource(file) });
      const probeVideoTrack = await probeInput.getPrimaryVideoTrack();

      if (!probeVideoTrack) {
        setError("Couldn't find a readable video track in this file.");
        setLoading(false);
        return;
      }

      if (!(await probeVideoTrack.canDecode())) {
        const codec = await probeVideoTrack.getCodec();
        setError(
          `Your browser can't decode this video's codec${codec ? ` (${codec})` : ""}. Try a different browser or convert the file first.`,
        );
        setLoading(false);
        return;
      }
    }
    setFrameProgress("");

    const chunkSize = 64 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const trimmedProjectName = projectName.trim();
    const fallbackProjectName = file.name.replace(/\.[^.]+$/, "").trim();
    const resolvedProjectName = trimmedProjectName || fallbackProjectName || "Untitled Project";

    try {
      // 1. Initialize Upload
      const startResponse = await fetch("/api/upload/start", { method: "POST", headers: { "x-project-name": resolvedProjectName } });
      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        throw new Error(errorData.error || "Failed to start upload");
      }

      const { uploadId, projectId } = (await startResponse.json()) as {
        uploadId: string;
        projectId: string;
      };

      // 2. Upload Video Chunks
      let uploaded = 0;
      const concurrency = Math.min(6, totalChunks);
      let nextIndex = 0;

      const uploadChunk = async (index: number) => {
        const start = index * chunkSize;
        const end = Math.min(file.size, start + chunkSize);
        const chunk = file.slice(start, end);

        const chunkResponse = await fetch(
          `/api/upload/chunk?uploadId=${uploadId}&index=${index}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body: chunk,
          },
        );

        if (!chunkResponse.ok) {
          const errorData = await chunkResponse.json();
          throw new Error(errorData.error || `Failed to upload chunk ${index}`);
        }

        uploaded += chunk.size;
        setProgressBytes(uploaded);
      };

      const workers = Array.from({ length: concurrency }, async () => {
        while (nextIndex < totalChunks) {
          const index = nextIndex;
          nextIndex += 1;
          await uploadChunk(index);
        }
      });

      await Promise.all(workers);

      // 3. Finalize Video Upload on Server
      const completeResponse = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId,
          projectId,
          totalChunks,
          projectName: resolvedProjectName,
        }),
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.error || "Failed to finalize upload");
      }

      await completeResponse.json();

      // 3.5 Upload Custom Thumbnail (required)
      setFrameProgress("Uploading custom thumbnail...");
      const thumbnailFormData = new FormData();
      thumbnailFormData.append("thumbnail", thumbnailFile);
      thumbnailFormData.append("projectId", projectId);

      const thumbnailResponse = await fetch("/api/uploadThumbnail", {
        method: "POST",
        body: thumbnailFormData,
      });

      if (!thumbnailResponse.ok) {
        const errorData = await thumbnailResponse.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error || "Failed to upload custom thumbnail",
        );
      }

      // ==========================================
      // FIXED MEDIABUNNY FRAME GENERATION FLOW
      // ==========================================
      setFrameProgress("Initializing MediaBunny pipeline...");
      const localVideoUrl = URL.createObjectURL(file);

      const pendingFrameUploads: Array<{ filename: string; blob: Blob }> = [];

      try {
        let frameIndex = 0;

        await extractFrames({
            src: localVideoUrl,
            timestampsInSeconds: (options) => {
              const duration = options.durationInSeconds ?? 0;
              const times: number[] = [];

              // Loop from 0 up to the total video duration, adding a timestamp every 1 second
              for (let t = 0; t <= duration; t+=3) {
                times.push(t);
              }

              return times;
            },


            onVideoSample: async (videoSample) => {
              frameIndex++;
              setFrameProgress(`MediaBunny decoding frame ${frameIndex}...`);

              // Calculate the timestamp in seconds (WebCodecs timestamps are usually in microseconds)
              const timestampInSeconds = (typeof videoSample.timestamp === "number")
                ? videoSample.timestamp.toFixed(2)
                : `index_${frameIndex}`;

              const filename = `frame_${timestampInSeconds}s.jpg`;

              // Size the canvas to match the source aspect ratio, capped to a 720p
              // bounding box (1280x720 landscape / 720x1280 portrait), so frames are
              // downscaled without being cropped or squished.
              const sourceWidth = videoSample.displayWidth;
              const sourceHeight = videoSample.displayHeight;
              const isPortrait = sourceHeight > sourceWidth;
              const maxWidth = isPortrait ? 720 : 1280;
              const maxHeight = isPortrait ? 1280 : 720;
              const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);

              const canvas = document.createElement("canvas");
              canvas.width = Math.round(sourceWidth * scale);
              canvas.height = Math.round(sourceHeight * scale);

              const ctx = canvas.getContext("2d");
              if (!ctx) return;

              if (typeof (videoSample as any).draw === "function") {
                (videoSample as any).draw(ctx, 0, 0, canvas.width, canvas.height);
              } else {
                const nativeFrame = (videoSample as any).toVideoFrame();
                ctx.drawImage(nativeFrame, 0, 0, canvas.width, canvas.height);
                nativeFrame.close();
              }

              // Drawing already copied the pixels out of videoSample, which mediabunny
              // disposes as soon as this callback returns — so only the (cheap, local)
              // blob encode happens here. The (slow, network) upload is queued and run
              // afterwards through a bounded worker pool, instead of serializing every
              // frame's fetch behind the next frame's decode.
              const frameBlob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85)
              );

              if (!frameBlob) return;

              pendingFrameUploads.push({ filename, blob: frameBlob });
            }
          });

          const totalFrames = pendingFrameUploads.length;
          let uploadedFrames = 0;
          const frameConcurrency = Math.min(6, totalFrames);
          let nextFrameIndex = 0;

          const uploadFrame = async (index: number) => {
            const { filename, blob } = pendingFrameUploads[index];

            const formData = new FormData();
            formData.append("frame", blob, filename);
            formData.append("projectId", projectId);

            const frameResponse = await fetch("/api/uploadFrames", {
              method: "POST",
              body: formData,
            });

            if (!frameResponse.ok) {
              throw new Error(`Failed uploading ${filename}`);
            }

            uploadedFrames += 1;
            setFrameProgress(`Uploading frame ${uploadedFrames}/${totalFrames}...`);
          };

          const frameWorkers = Array.from({ length: frameConcurrency }, async () => {
            while (nextFrameIndex < totalFrames) {
              const index = nextFrameIndex;
              nextFrameIndex += 1;
              await uploadFrame(index);
            }
          });

          await Promise.all(frameWorkers);
        } catch (error) {
          console.error("Frame extraction failed:", error);
        }

        const manifestResponse = await fetch("/api/createFramesManifest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: projectId }),
        });

        if (!manifestResponse.ok) {
          throw new Error("Failed to create frames manifest");
        }

        // ==========================================
        // OPTIMIZED MEDIABUNNY AUDIO CONVERSION
        // ==========================================
        setFrameProgress("Extracting and converting audio stream with MediaBunny...");

        const { Input, Output, BufferTarget, Conversion, UrlSource, ALL_FORMATS, Mp4OutputFormat  } = await import('mediabunny');

        const audioInputInstance = new Input({
          formats: ALL_FORMATS,
          source: new UrlSource(localVideoUrl),
        });

        const target = new BufferTarget();
        const audioOutputInstance = new Output({
          format: new Mp4OutputFormat(),
          target: target,
        });

        const conversion = await Conversion.init({
          input: audioInputInstance,
          output: audioOutputInstance,
          video: { discard: true }, // Drop the video tracks
          audio: { forceTranscode: true, bitrate: 32000, numberOfChannels: 1 } // Let it pass-through or transcode to AAC naturally
        });

        if (conversion.isValid) {
          await conversion.execute();

          if (!target.buffer) {
            throw new Error("Audio conversion did not produce an output buffer.");
          }

          const audioBlob = new Blob([target.buffer], { type: "audio/mp4" });

          setFrameProgress("Uploading audio.mp4 track package...");
          const audioFormData = new FormData();
          audioFormData.append("audio", audioBlob, "audio.mp4");
          audioFormData.append("projectId", projectId);

          const audioResponse = await fetch("/api/uploadAudio", {
            method: "POST",
            body: audioFormData,
          });

          if (!audioResponse.ok) {
            throw new Error("Failed to upload stripped audio track.");
          }
        } else {
          console.warn("Audio conversion configuration mismatch:", conversion.discardedTracks);
        }
        // ==========================================

      // 4. Refresh State on Success
      await loadProjects();

      setFile(null);
      setThumbnailFile(null);
      setProjectName("");
      alert("Project created, frames processed, and audio uploaded successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
      setFrameProgress("");
    }
  };


  const runWorkflow = async (projectName: string, action?: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/shortsWorkflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: `${projectName}`, action }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start workflow");
      }

      await response.json();
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start workflow");
    } finally {
      setLoading(false);
    }
  };

  const getShortField = (short: Short, field: "title" | "description") =>
    shortEdits[short.id]?.[field] ?? short[field];

  const setShortField = (shortId: string, field: "title" | "description", value: string) =>
    setShortEdits((prev) => ({ ...prev, [shortId]: { ...prev[shortId], [field]: value } }));

  const setShortState = (shortId: string, patch: Partial<ShortUiState>) =>
    setShortEdits((prev) => ({ ...prev, [shortId]: { ...prev[shortId], ...patch } }));

  const shortDurationSeconds = (short: Short) =>
    short.segments.reduce((sum, seg) => sum + Math.max(0, seg.end - seg.start), 0);

  const saveShort = async (projectId: string, short: Short) => {
    setShortState(short.id, { saving: true, error: undefined, success: undefined });
    try {
      const title = getShortField(short, "title");
      const description = getShortField(short, "description");
      const response = await fetch("/api/updateShort", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, shortId: short.id, title, description }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as { error?: string }).error || "Failed to save short");
      }

      await loadProjects();
      setShortState(short.id, { saving: false, success: "Saved." });
    } catch (err) {
      setShortState(short.id, {
        saving: false,
        error: err instanceof Error ? err.message : "Failed to save short",
      });
    }
  };

  const uploadShortToYoutube = async (projectId: string, shortId: string) => {
    setShortState(shortId, { uploading: true, error: undefined });
    try {
      const response = await fetch("/api/uploadToYoutube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, shortId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to upload to YouTube");
      }

      await loadProjects();
      setShortState(shortId, { uploading: false });
    } catch (err) {
      setShortState(shortId, {
        uploading: false,
        error: err instanceof Error ? err.message : "Failed to upload to YouTube",
      });
    }
  };

  // Renders run server-side and outlive the page, so progress is polled rather
  // than streamed — a dropped phone connection or a refresh then costs nothing.
  const startRender = async (projectId: string, shortId?: string) => {
    if (shortId) setShortState(shortId, { error: undefined, success: undefined });
    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, shortId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        jobs?: RenderJob[];
        error?: string;
      };

      if (!response.ok) throw new Error(data.error || "Failed to start render");

      setRenderJobs((prev) => {
        const next = { ...prev };
        for (const job of data.jobs ?? []) next[job.shortId] = job;
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start render";
      if (shortId) setShortState(shortId, { error: message });
      else setError(message);
    }
  };

  const cancelRender = async (jobId: string) => {
    await fetch(`/api/render?jobId=${encodeURIComponent(jobId)}`, { method: "DELETE" });
  };

  useEffect(() => {
    if (!openProjectId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/render?projectId=${encodeURIComponent(openProjectId)}`,
        );
        if (!response.ok) return;
        const { jobs } = (await response.json()) as { jobs: RenderJob[] };
        if (cancelled) return;

        // listJobs is newest-first, so the first job seen per short wins.
        const latest: Record<string, RenderJob> = {};
        for (const job of jobs) if (!latest[job.shortId]) latest[job.shortId] = job;
        setRenderJobs(latest);
      } catch {
        // A failed poll is not worth surfacing; the next tick will retry.
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [openProjectId]);

  const activeRenderCount = Object.values(renderJobs).filter((job) =>
    ACTIVE_RENDER_STATUSES.includes(job.status),
  ).length;

  const openProject = projects.find((p) => p.id === openProjectId) ?? null;

  return (
    <div className="px-6 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-border bg-card shadow-2xl shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl text-foreground">Create Project</CardTitle>
              <CardDescription className="text-foreground">
                Select an MP4 to create a new project folder.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Project Name
                </label>
                <Input
                  type="text"
                  placeholder="My Next Short"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Upload MP4 or MOV
                </label>
                <Input
                  type="file"
                  accept="video/mp4,video/quicktime,.mp4,.mov"
                  className="text-foreground align-middle file:mr-4 file:rounded-md file:border-0 file:text-foreground file:font-medium"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Upload Thumbnail (Required)
                </label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="text-foreground align-middle file:mr-4 file:rounded-md file:border-0 file:text-foreground file:font-medium"
                  onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {file ? (
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-foreground">
                    Selected File
                  </div>
                  <div className="mt-2 break-all text-sm text-foreground">
                    {file.name}
                  </div>
                </div>
              ) : null}

              {thumbnailFile ? (
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-foreground">
                    Selected Thumbnail
                  </div>
                  <div className="mt-2 break-all text-sm text-foreground">
                    {thumbnailFile.name}
                  </div>
                </div>
              ) : null}

              {projectName.trim() ? (
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-foreground">
                    Project Name
                  </div>
                  <div className="mt-2 break-all text-sm text-foreground">
                    {projectName.trim()}
                  </div>
                </div>
              ) : null}

              {loading && file ? (
                <div className="text-xs text-muted-foreground">
                  Uploading: {(progressBytes / (1024 * 1024)).toFixed(2)} MB / {(file.size / (1024 * 1024)).toFixed(2)} MB
                </div>
              ) : null}

              {frameProgress ? (
                <div className="text-xs text-primary font-mono animate-pulse mt-1">
                  🐰 {frameProgress}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
            </CardContent>

            <CardFooter className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={createProject} disabled={loading || !file || !thumbnailFile}>
                {loading ? "Creating..." : "Create Project"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-border bg-card shadow-2xl shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl text-foreground">Project Summary</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-foreground">
                    Total Projects
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-primary">
                    {projects.length}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-foreground">
                    Ready
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-primary">
                    {projects.filter((project) => project.renderCount > 0).length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          {openProject ? (
            <>
              <div className="mb-4 flex items-center gap-3">
                <Button variant="secondary" size="sm" onClick={() => setOpenProjectId(null)}>
                  ← Back to Projects
                </Button>
                <h2 className="truncate text-2xl font-semibold tracking-tight">{openProject.name}</h2>
              </div>

              <div className="flex flex-col gap-6">
                <Card className="border-border bg-card">
                  <CardContent className="space-y-3 pt-6">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                        Project ID: {openProject.id}
                      </div>
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                        Uploaded: {formatUploadedAt(openProject.uploadedAt)}
                      </div>
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                        Video file size: {formatFileSize(openProject.fileSizeBytes)}
                      </div>
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                        Audio file size: {formatFileSize(openProject.audioFileSizeBytes)}
                      </div>
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                        Frames: {openProject.frameCount}
                      </div>
                    </div>

                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Select workflow action for ${openProject.name}`}
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                          value={projectActions[openProject.id] ?? defaultWorkflowAction}
                          onChange={(e) => {
                            const nextAction = e.target.value;
                            setProjectActions((prev) => ({
                              ...prev,
                              [openProject.id]: nextAction,
                            }));
                          }}
                          disabled={loading}
                        >
                          <option value="runShortsWorkflow">Run Shorts Workflow</option>
                          <option value="regenerateInstructions">Regenerate Instructions</option>
                          <option value="generateYoutubeChapters">Generate YouTube Chapters</option>
                        </select>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void runWorkflow(openProject.id, projectActions[openProject.id] ?? defaultWorkflowAction)
                          }
                          disabled={loading}
                        >
                          {loading ? "Running..." : "Run Action"}
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => window.open(`/projects/${openProject.id}/instructions.json`, "_blank")}>
                          View Instructions
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => window.open(`/projects/${openProject.id}/youtube_chapters.txt`, "_blank")}>
                          View Youtube Chapters
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-tight">Shorts</h3>
                    {openProject.shorts.length > 0 ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void startRender(openProject.id)}
                        disabled={activeRenderCount > 0}
                      >
                        {activeRenderCount > 0
                          ? `Rendering (${activeRenderCount} left)...`
                          : "Render all"}
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-4">
                    {openProject.shorts.map((short) => {
                      const state = shortEdits[short.id];
                      const job = renderJobs[short.id];
                      const rendering = job
                        ? ACTIVE_RENDER_STATUSES.includes(job.status)
                        : false;
                      return (
                        <Card key={short.id} className="border-border bg-card">
                          <CardContent className="space-y-3 pt-6">
                            <Input
                              value={getShortField(short, "title")}
                              onChange={(e) => setShortField(short.id, "title", e.target.value)}
                              placeholder="Short title"
                              className="text-foreground"
                            />
                            <textarea
                              value={getShortField(short, "description")}
                              onChange={(e) => setShortField(short.id, "description", e.target.value)}
                              placeholder="Short description"
                              rows={3}
                              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none"
                            />
                            <div className="text-xs text-muted-foreground">
                              {short.segments.length} segments · {shortDurationSeconds(short).toFixed(1)}s
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => void saveShort(openProject.id, short)}
                                disabled={state?.saving}
                              >
                                {state?.saving ? "Saving..." : "Save"}
                              </Button>

                              {rendering ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => void cancelRender(job.id)}
                                >
                                  Cancel render
                                </Button>
                              ) : (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => void startRender(openProject.id, short.id)}
                                  disabled={activeRenderCount > 0}
                                >
                                  {job?.status === "done" ? "Re-render" : "Render"}
                                </Button>
                              )}

                              {job?.status === "done" && job.outputUrl ? (
                                <a
                                  href={job.outputUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-primary hover:underline"
                                >
                                  Preview ↗
                                </a>
                              ) : null}

                              {short.youtubeVideoUrl ? (
                                <a
                                  href={short.youtubeVideoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-primary hover:underline"
                                >
                                  View on YouTube ↗
                                </a>
                              ) : (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => void uploadShortToYoutube(openProject.id, short.id)}
                                  disabled={state?.uploading}
                                >
                                  {state?.uploading ? "Uploading..." : "Upload to YouTube"}
                                </Button>
                              )}
                            </div>

                            {job && rendering ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{job.phase}</span>
                                  {job.progress !== null ? (
                                    <span>{Math.round(job.progress * 100)}%</span>
                                  ) : null}
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                                    style={{
                                      width:
                                        job.progress !== null
                                          ? `${Math.round(job.progress * 100)}%`
                                          : "100%",
                                      opacity: job.progress !== null ? 1 : 0.4,
                                    }}
                                  />
                                </div>
                              </div>
                            ) : null}

                            {job?.status === "error" && job.error ? (
                              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                                Render failed: {job.error}
                              </div>
                            ) : null}

                            {state?.error ? (
                              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                                {state.error}
                              </div>
                            ) : null}
                            {state?.success ? (
                              <div className="text-xs text-primary">{state.success}</div>
                            ) : null}
                          </CardContent>
                        </Card>
                      );
                    })}

                    {openProject.shorts.length === 0 ? (
                      <Card className="border-border bg-card">
                        <CardContent className="py-6 text-center text-sm text-muted-foreground">
                          No shorts yet — run the workflow above to generate some.
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => (
                  <Card
                    key={project.id}
                    onClick={() => setOpenProjectId(project.id)}
                    className="cursor-pointer border-border bg-card shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-primary"
                  >
                    <CardHeader>
                      <CardTitle className="truncate text-lg text-foreground">{project.name}</CardTitle>
                      <CardDescription className="text-foreground">{project.renderCount} shorts</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                        Project ID: {project.id}
                      </div>
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                        Uploaded: {formatUploadedAt(project.uploadedAt)}
                      </div>
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                        Video file size: {formatFileSize(project.fileSizeBytes)}
                      </div>
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                        Audio file size: {formatFileSize(project.audioFileSizeBytes)}
                      </div>
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                        Frames: {project.frameCount}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void fetch(`/api/deleteProject?provisionId=${project.id}`, { method: "DELETE" }).then(() =>
                            window.location.reload(),
                          );
                        }}
                      >
                        Delete Project
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                {projects.length === 0 ? (
                  <Card className="border-border bg-card">
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      No projects found yet.
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default ShortsWorkflow;