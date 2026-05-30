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
  name: string;
  shorts: Array<{
    id: string;
    segments: { start: number; end: number }[];
  }>;
  renderCount: number;
};

const Home: NextPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

    if (!file) {
      setError("Please select an MP4 file to upload.");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/createProject", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create project");
      }

      await response.json();
      await loadProjects();
      setFile(null);
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
  }

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
                    {project.shorts.length} shorts loaded from instructions.json
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void runWorkflow(project.name)} disabled={loading}>
                    {loading ? "Running..." : "Run Shorts Workflow"}
                  </Button>
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

