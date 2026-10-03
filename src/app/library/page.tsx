"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCallback, useEffect, useState } from "react";
import type { NextPage } from "next";

type Location = {
  projectType: "video" | "reels";
  projectId: string;
  projectName: string;
  mediaId?: string;
  second: number | null;
  image: string;
};

type SearchResult = {
  assetId: string;
  kind: "photo" | "video" | "frame";
  description: string;
  score: number;
  locations: Location[];
};

type VideoProject = { id: string; name: string; frameCount: number; indexedFrames: number };

type LibraryResponse = {
  stats: { frames: number; photos: number; videos: number; analyses: number; embedded: number };
  videoProjects: VideoProject[];
  results: SearchResult[];
  error?: string;
};

const POLL_INTERVAL_MS = 4000;

// Stop watching an indexing run that hasn't moved in this many polls (~1 min):
// it has finished with some frames failed, or stopped.
const STALE_POLLS = 15;

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

const KIND_LABELS: Record<SearchResult["kind"], string> = {
  frame: "Video frame",
  photo: "Photo",
  video: "Clip",
};

const FootageLibrary: NextPage = () => {
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState<LibraryResponse | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  // Projects this page started indexing, with how many polls they've gone unchanged.
  const [indexing, setIndexing] = useState<Record<string, { last: number; stale: number }>>({});

  const loadLibrary = useCallback(async () => {
    try {
      const response = await fetch("/api/library");
      const data = (await response.json()) as LibraryResponse;
      if (!response.ok) throw new Error(data.error || "Failed to load the library");
      setLibrary(data);

      setIndexing((current) => {
        const next: typeof current = {};
        for (const [id, watch] of Object.entries(current)) {
          const project = data.videoProjects.find((p) => p.id === id);
          if (!project || project.indexedFrames >= project.frameCount) continue;
          const stale = project.indexedFrames === watch.last ? watch.stale + 1 : 0;
          if (stale < STALE_POLLS) next[id] = { last: project.indexedFrames, stale };
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the library");
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const anyIndexing = Object.keys(indexing).length > 0;
  useEffect(() => {
    if (!anyIndexing) return;
    const interval = window.setInterval(() => void loadLibrary(), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [anyIndexing, loadLibrary]);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError("");
    try {
      const response = await fetch(`/api/library?q=${encodeURIComponent(q)}`);
      const data = (await response.json()) as LibraryResponse;
      if (!response.ok) throw new Error(data.error || "Search failed");
      setLibrary(data);
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const indexProject = async (project: VideoProject) => {
    setError("");
    try {
      const response = await fetch("/api/indexFootage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: project.id }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Failed to start indexing");
      setIndexing((current) => ({ ...current, [project.id]: { last: project.indexedFrames, stale: 0 } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start indexing");
    }
  };

  const stats = library?.stats;

  return (
    <div className="px-6 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <Card className="border-border bg-card shadow-2xl shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">Footage Library</CardTitle>
            <CardDescription className="text-foreground">
              Search every analysed photo, clip and video frame across all your projects.
              {stats
                ? ` ${stats.frames} video frames, ${stats.photos} photos and ${stats.videos} clips indexed.`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !searching) void search();
                }}
                placeholder="e.g. sunrise on a ridge, push-ups by a window, night running"
                className="text-foreground placeholder:text-muted-foreground"
              />
              <Button variant="secondary" onClick={() => void search()} disabled={searching || !query.trim()}>
                {searching ? "Searching..." : "Search"}
              </Button>
            </div>
            {error ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {results ? (
          <section>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight">Results</h2>
            {results.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Nothing matched. Index more footage below, or try different words.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {results.map((result) => {
                  const location = result.locations[0];
                  return (
                    <Card key={result.assetId} className="overflow-hidden border-border bg-card pt-0">
                      <a href={`/${location.image}`} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/${location.image}`}
                          alt={result.description}
                          className="aspect-video w-full bg-black object-cover"
                          loading="lazy"
                        />
                      </a>
                      <CardContent className="space-y-1 text-sm">
                        <div className="text-foreground">{result.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {KIND_LABELS[result.kind]} · {location.projectName}
                          {location.second !== null ? ` at ${formatTime(location.second)}` : ""}
                          {result.locations.length > 1 ? ` · +${result.locations.length - 1} more` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">Visual score {result.score}/10</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        <section>
          <h2 className="mb-1 text-2xl font-semibold tracking-tight">Video Projects</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            The clips workflow indexes up to 150 frames of a video as it runs. Index all frames to make every
            moment searchable; frames already indexed are skipped.
          </p>
          <div className="flex flex-col gap-3">
            {(library?.videoProjects ?? []).map((project) => {
              const complete = project.indexedFrames >= project.frameCount;
              const running = project.id in indexing;
              return (
                <Card key={project.id} className="border-border bg-card">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <div className="font-medium text-foreground">{project.name}</div>
                      <div className={running ? "animate-pulse text-xs text-primary" : "text-xs text-muted-foreground"}>
                        {project.indexedFrames} / {project.frameCount} frames indexed
                        {running ? " — indexing…" : ""}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void indexProject(project)}
                      disabled={complete || running}
                    >
                      {complete ? "Fully Indexed" : "Index All Frames"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default FootageLibrary;
