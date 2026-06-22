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
  Input as BunnyInput, // Aliased to avoid naming conflict with shadcn UI Input
  UrlSource, 
  VideoSample, 
  VideoSampleSink 
} from 'mediabunny';

type Project = {
  id: string;
  name: string;
  shorts: Array<{
    id: string;
    segments: { start: number; end: number }[];
  }>;
  renderCount: number;
  uploadedAt: string | null;
  fileSizeBytes: number | null;
};

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

const Home: NextPage = () => {
  const defaultWorkflowAction = "runShortsWorkflow";
  const [file, setFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressBytes, setProgressBytes] = useState(0);
  const [projectActions, setProjectActions] = useState<Record<string, string>>({});
  const [frameProgress, setFrameProgress] = useState("");

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

    const chunkSize = 64 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const trimmedProjectName = projectName.trim();
    const fallbackProjectName = file.name.replace(/\.[^.]+$/, "").trim();
    const resolvedProjectName = trimmedProjectName || fallbackProjectName || "Untitled Project";

    try {
      // 1. Initialize Upload
      const startResponse = await fetch("/api/upload/start", { method: "POST" });
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

      // ==========================================
      // FIXED MEDIABUNNY FRAME GENERATION FLOW
      // ==========================================
      setFrameProgress("Initializing MediaBunny pipeline...");
      const localVideoUrl = URL.createObjectURL(file);

      try {
        let frameIndex = 0;

        await extractFrames({
          src: localVideoUrl,
          timestampsInSeconds: (options) => {
            const duration = options.durationInSeconds ?? 0;
            const totalFramesToExtract = 5;
            const times: number[] = [];
            for (let i = 0; i < totalFramesToExtract; i++) {
              times.push((duration / totalFramesToExtract) * i);
            }
            return times;
          },
          onVideoSample: async (videoSample) => {
            frameIndex++;
            setFrameProgress(`MediaBunny decoding and uploading frame ${frameIndex}/5...`);

            // 1. Setup offscreen canvas since VideoSample doesn't have a direct toBlob method
            const canvas = document.createElement("canvas");
            canvas.width = videoSample.displayWidth || 1280;
            canvas.height = videoSample.displayHeight || 720;
            
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // 2. Safely unpack pixel frames onto the rendering layout context
            if (typeof (videoSample as any).draw === "function") {
              (videoSample as any).draw(ctx, 0, 0);
            } else {
              const nativeFrame = (videoSample as any).toVideoFrame();
              ctx.drawImage(nativeFrame, 0, 0, canvas.width, canvas.height);
              nativeFrame.close(); // Clean up native references immediately
            }

            // 3. Convert frame snapshot to a regular JPEG Blob
            const frameBlob = await new Promise<Blob | null>((resolve) => 
              canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85)
            );

            if (!frameBlob) return;

            // 4. Send FormData sequentially up to your Next.js route API
            const formData = new FormData();
            formData.append("frame", frameBlob, `frame_${frameIndex - 1}.jpg`);
            formData.append("projectId", projectId);

            const frameResponse = await fetch("/api/uploadFrames", {
              method: "POST",
              body: formData,
            });

            if (!frameResponse.ok) {
              throw new Error(`Failed uploading frame_${frameIndex - 1}.jpg`);
            }
          }
        });
      } finally {
        URL.revokeObjectURL(localVideoUrl);
        setFrameProgress("");
      }
      // ==========================================

      // 4. Refresh State on Success
      await loadProjects();

      setFile(null);
      setProjectName("");
      alert("Project created and frames processed successfully!");
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

  const runProjectAction = async (projectId: string) => {
    const selectedAction = projectActions[projectId] ?? defaultWorkflowAction;
    if (selectedAction === "runShortsWorkflow") {
      await runWorkflow(projectId);
      return;
    }

    await runWorkflow(projectId, selectedAction);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="max-w-3xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
            Remotion Shorts Workflow
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Upload a video, create a project, and run the workflow.
          </h1>
          <p className="text-sm leading-6 text-slate-300 sm:text-base">
            Each upload creates a unique project folder under public/projects, and the
            workflow writes the generated instructions back into the same folder.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-100">Create Project</CardTitle>
              <CardDescription className="text-slate-100">
                Select an MP4 to create a new project folder.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Project Name
                </label>
                <Input
                  type="text"
                  placeholder="My Next Short"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Upload MP4
                </label>
                <Input
                  type="file"
                  accept="video/mp4"
                  className="text-slate-100 align-middle file:mr-4 file:rounded-md file:border-0 file:text-slate-100 file:font-medium"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {file ? (
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-100">
                    Selected File
                  </div>
                  <div className="mt-2 break-all text-sm text-slate-100">
                    {file.name}
                  </div>
                </div>
              ) : null}

              {projectName.trim() ? (
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-100">
                    Project Name
                  </div>
                  <div className="mt-2 break-all text-sm text-slate-100">
                    {projectName.trim()}
                  </div>
                </div>
              ) : null}

              {loading && file ? (
                <div className="text-xs text-slate-400">
                  Uploading: {(progressBytes / (1024 * 1024)).toFixed(2)} MB / {(file.size / (1024 * 1024)).toFixed(2)} MB
                </div>
              ) : null}

              {frameProgress ? (
                <div className="text-xs text-cyan-400 font-mono animate-pulse mt-1">
                  🐰 {frameProgress}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-red-900/50 bg-red-950/40 p-4 text-sm text-red-300">
                  {error}
                </div>
              ) : null}
            </CardContent>

            <CardFooter className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={createProject} disabled={loading || !file}>
                {loading ? "Creating..." : "Create Project"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl text-slate-100">Project Summary</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-100">
                    Total Projects
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-cyan-300">
                    {projects.length}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-100">
                    Ready
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-300">
                    {projects.filter((project) => project.renderCount > 0).length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="border-slate-800 bg-slate-900/75 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-cyan-500/40"
              >
                <CardHeader>
                  <CardTitle className="truncate text-lg text-slate-100">{project.name}</CardTitle>
                  <CardDescription className="text-slate-100">{project.renderCount} shorts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                    Project ID: {project.id}
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                    Uploaded: {formatUploadedAt(project.uploadedAt)}
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                    File size: {formatFileSize(project.fileSizeBytes)}
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`Select workflow action for ${project.name}`}
                        className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100"
                        value={projectActions[project.id] ?? defaultWorkflowAction}
                        onChange={(e) => {
                          const nextAction = e.target.value;
                          setProjectActions((prev) => ({
                            ...prev,
                            [project.id]: nextAction,
                          }));
                        }}
                        disabled={loading}
                      >
                        <option value="runShortsWorkflow">Run Shorts Workflow</option>
                        <option value="regenerateInstructions">Regenerate Instructions</option>
                        <option value="normaliseVideo">Normalise Video</option>
                      </select>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void runProjectAction(project.id)}
                        disabled={loading}
                      >
                        {loading ? "Running..." : "Run Action"}
                      </Button>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button variant="secondary" size="sm" onClick={() => window.open(`/projects/${project.id}/instructions.json`, "_blank")}>
                        View Instructions
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => fetch(`/api/deleteProject?provisionId=${project.id}`, { method: "DELETE" }).then(() => window.location.reload())}>
                        Delete Project
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {projects.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/75">
                <CardContent className="py-10 text-center text-sm text-slate-400">
                  No projects found yet.
                </CardContent>
              </Card>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
};

export default Home;