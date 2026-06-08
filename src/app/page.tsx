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

type Project = {
  id: string;
  name: string;
  shorts: Array<{
    id: string;
    segments: { start: number; end: number }[];
  }>;
  renderCount: number;
};

const Home: NextPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressBytes, setProgressBytes] = useState(0);

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
      const startResponse = await fetch("/api/upload/start", { method: "POST" });
      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        throw new Error(errorData.error || "Failed to start upload");
      }

      const { uploadId, projectId } = (await startResponse.json()) as {
        uploadId: string;
        projectId: string;
      };

      let uploaded = 0;
      const concurrency = Math.min(4, totalChunks);
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
      await loadProjects();
      setFile(null);
      setProjectName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const runWorkflow = async (projectName: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/shortsWorkflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: `${projectName}` }),
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
                <p className="text-xs text-slate-400">
                  This name is saved in metadata.json for the project and shown in the list.
                </p>
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
                <p className="text-xs text-slate-400">
                  The file will be saved as video.mp4 inside a unique project directory.
                </p>
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

              {error ? (
                <div className="rounded-lg border border-red-900/50 bg-red-950/40 p-4 text-sm text-red-300">
                  {error}
                </div>
              ) : null}
            </CardContent>

            <CardFooter className="flex flex-wrap gap-3">
              <Button onClick={createProject} disabled={loading || !file}>
                {loading ? "Creating..." : "Create Project"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl text-slate-100">Project Summary</CardTitle>
              <CardDescription className="text-slate-100">
                Projects returned by the findProjects API.
              </CardDescription>
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

              <p className="text-sm text-slate-400">
                Select a project from the list below to inspect it later.
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
              <p className="mt-1 text-sm text-slate-400">
                Folders discovered from public/projects.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Card
                key={project.name}
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
                    {project.shorts.length} shorts loaded from instructions.json
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                    <Button variant="outline" size="sm" onClick={() => void runWorkflow(project.id)} disabled={loading}>
                      {loading ? "Running..." : "Run Shorts Workflow"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(`/projects/${project.id}/instructions.json`, "_blank")}>
                      View Instructions
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fetch(`/api/deleteProject?provisionId=${project.id}`, { method: "DELETE" }).then(() => window.location.reload())}>
                      Delete Project
                    </Button>
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

