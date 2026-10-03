"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useCallback, useEffect, useState } from "react";
import type { NextPage } from "next";

type ReelStatus = "importing" | "analysing" | "researching" | "planning" | "ready" | "failed";

type ReelSummary = {
  id: string;
  title: string;
  trendName: string;
  durationSeconds: number;
  bpm: number;
  sound: { title: string; artist: string; bpm: number | null };
  soundNote: string;
  caption: string;
  shots: Array<{ text: string | null }>;
};

type ReelProject = {
  id: string;
  name: string;
  source: { kind: "photos"; album: string; albumId?: string; albumPath?: string[] } | { kind: "folder"; folder: string };
  createdAt: string;
  status: ReelStatus | null;
  statusDetail: string | null;
  photoCount: number;
  videoCount: number;
  skippedCount: number;
  summary: string | null;
  trends: Array<{ id: string; name: string; whyNow: string; origin: "web" | "evergreen"; sourceUrls: string[] }>;
  trendsOrigin: "web" | "evergreen" | null;
  generatedAt: string | null;
  reels: ReelSummary[];
};

type PhotosAlbum = { id: string; name: string; path: string[]; count: number };

const albumLabel = (album: { name: string; path: string[] }) => [...album.path, album.name].join(" / ");

const STATUS_LABELS: Record<ReelStatus, string> = {
  importing: "Importing media…",
  analysing: "Analysing photos and clips…",
  researching: "Researching what's trending…",
  planning: "Planning reels…",
  ready: "Ready",
  failed: "Failed",
};

const isRunning = (status: ReelStatus | null) => status !== null && status !== "ready" && status !== "failed";

const POLL_INTERVAL_MS = 4000;

const hostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const ReelsWorkflow: NextPage = () => {
  const [folder, setFolder] = useState("");
  const [albums, setAlbums] = useState<PhotosAlbum[] | null>(null);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [albumFilter, setAlbumFilter] = useState("");
  const [projects, setProjects] = useState<ReelProject[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/findReels");
      if (!response.ok) throw new Error("Failed to load reels projects");
      setProjects((await response.json()) as ReelProject[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reels projects");
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  // Runs take a few minutes; keep the statuses fresh while any are in flight.
  const anyRunning = projects.some((p) => isRunning(p.status));
  useEffect(() => {
    if (!anyRunning) return;
    const interval = window.setInterval(() => void loadProjects(), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [anyRunning, loadProjects]);

  const startRun = async (body: Record<string, unknown>) => {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/reelsWorkflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Failed to start the reels workflow");
      await loadProjects();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start the reels workflow");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const loadAlbums = async () => {
    setAlbumsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/photosAlbums");
      const data = (await response.json()) as { albums?: PhotosAlbum[]; error?: string };
      if (!response.ok || !data.albums) throw new Error(data.error || "Couldn't read your Photos library");
      setAlbums(data.albums);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read your Photos library");
    } finally {
      setAlbumsLoading(false);
    }
  };

  const togglePicker = () => {
    const opening = !pickerOpen;
    setPickerOpen(opening);
    if (opening && albums === null) void loadAlbums();
  };

  const syncedProject = (album: PhotosAlbum) =>
    projects.find((p) => p.source.kind === "photos" && p.source.albumId === album.id);

  // An album that's already synced is synced again rather than duplicated.
  const syncAlbum = async (album: PhotosAlbum) => {
    const existing = syncedProject(album);
    const started = existing
      ? await startRun({ projectId: existing.id, action: "resync" })
      : await startRun({ album: { id: album.id, name: album.name, path: album.path } });
    if (started) {
      setPickerOpen(false);
      setAlbumFilter("");
    }
  };

  const importFolder = async () => {
    if (await startRun({ source: folder.trim() })) {
      setFolder("");
    }
  };

  const filter = albumFilter.trim().toLowerCase();
  const visibleAlbums = (albums ?? []).filter((album) => albumLabel(album).toLowerCase().includes(filter));

  const copyCaption = async (reelKey: string, caption: string) => {
    await navigator.clipboard.writeText(caption);
    setCopied(reelKey);
    window.setTimeout(() => setCopied((current) => (current === reelKey ? null : current)), 1500);
  };

  return (
    <div className="px-6 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <Card className="border-border bg-card shadow-2xl shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">Create Reels</CardTitle>
            <CardDescription className="text-foreground">
              Point at a Photos album and get 3–5 reels built on formats trending right now.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button variant="secondary" onClick={togglePicker} disabled={submitting}>
                {pickerOpen ? "Close Album List" : "Choose Album to Sync"}
              </Button>

              {pickerOpen ? (
                <div className="rounded-lg border border-border bg-muted/30">
                  <div className="flex gap-2 border-b border-border p-2">
                    <Input
                      autoFocus
                      value={albumFilter}
                      onChange={(e) => setAlbumFilter(e.target.value)}
                      placeholder="Filter albums"
                      className="text-foreground placeholder:text-muted-foreground"
                    />
                    <Button variant="secondary" size="sm" onClick={() => void loadAlbums()} disabled={albumsLoading}>
                      Reload
                    </Button>
                  </div>
                  {albumsLoading ? (
                    <div className="animate-pulse p-4 text-sm text-muted-foreground">Reading your Photos library…</div>
                  ) : (
                    <ul className="max-h-80 overflow-y-auto py-1">
                      {visibleAlbums.map((album) => {
                        const synced = Boolean(syncedProject(album));
                        return (
                          <li key={album.id}>
                            <button
                              type="button"
                              onClick={() => void syncAlbum(album)}
                              disabled={album.count === 0 || submitting}
                              className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <span className="min-w-0 truncate">
                                {album.path.length > 0 ? (
                                  <span className="text-muted-foreground">{album.path.join(" / ")} / </span>
                                ) : null}
                                <span className="text-foreground">{album.name}</span>
                              </span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {album.count === 0 ? "empty" : `${album.count} items`}
                                {synced ? " · synced" : ""}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                      {albums !== null && visibleAlbums.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-muted-foreground">No albums match.</li>
                      ) : null}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Input
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && folder.trim() && !submitting) void importFolder();
                }}
                placeholder="Or a folder of photos and clips, e.g. /Users/me/Pictures/Trip"
                className="text-foreground placeholder:text-muted-foreground"
              />
              <Button variant="secondary" onClick={() => void importFolder()} disabled={submitting || !folder.trim()}>
                Import Folder
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              The first time, macOS asks for permission to control Photos. Photos only stored in iCloud download during
              the export, so big albums take a while; up to 120 items are used, favourites first.
            </p>
            {error ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-semibold tracking-tight">Reels Projects</h2>

          {projects.map((project) => (
            <Card key={project.id} className="border-border bg-card">
              <CardHeader>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <CardTitle className="text-lg text-foreground">{project.name}</CardTitle>
                  <span
                    className={
                      project.status === "failed"
                        ? "text-xs text-destructive"
                        : isRunning(project.status)
                          ? "animate-pulse text-xs text-primary"
                          : "text-xs text-muted-foreground"
                    }
                  >
                    {project.status ? STATUS_LABELS[project.status] : "Unknown"}
                  </span>
                </div>
                <CardDescription className="text-foreground">
                  {project.source.kind === "photos"
                    ? `Photos album · ${albumLabel({ name: project.source.album, path: project.source.albumPath ?? [] })}`
                    : `Folder · ${project.source.folder}`}{" "}
                  · {project.photoCount} photos ·{" "}
                  {project.videoCount} videos
                  {project.skippedCount > 0 ? ` · ${project.skippedCount} skipped` : ""}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {project.status === "failed" && project.statusDetail ? (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {project.statusDetail}
                  </div>
                ) : null}

                {project.summary ? <p className="text-sm text-muted-foreground">{project.summary}</p> : null}

                {project.trendsOrigin === "evergreen" ? (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
                    Trend research didn&apos;t come back, so these reels use evergreen formats rather than this
                    week&apos;s trends. Regenerate to try again.
                  </div>
                ) : null}

                {project.trends.some((t) => t.origin === "web") ? (
                  <details className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                    <summary className="cursor-pointer text-foreground">
                      Trending formats found ({project.trends.filter((t) => t.origin === "web").length})
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {project.trends
                        .filter((t) => t.origin === "web")
                        .map((trend) => (
                          <li key={trend.id}>
                            <span className="font-medium text-foreground">{trend.name}</span>
                            <span className="text-muted-foreground"> — {trend.whyNow}</span>
                            {trend.sourceUrls.length > 0 ? (
                              <span className="ml-1 text-xs">
                                {trend.sourceUrls.map((url) => (
                                  <a
                                    key={url}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mr-2 text-primary hover:underline"
                                  >
                                    {hostname(url)} ↗
                                  </a>
                                ))}
                              </span>
                            ) : null}
                          </li>
                        ))}
                    </ul>
                  </details>
                ) : null}

                {project.reels.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground">
                      Render these from the Reels folder in Remotion Studio, then add the sound in Instagram&apos;s
                      editor.
                    </p>
                    {project.reels.map((reel, index) => {
                      const reelKey = `${project.id}-${reel.id}`;
                      const texts = [...new Set(reel.shots.flatMap((s) => (s.text ? [s.text] : [])))];
                      return (
                        <div key={reel.id} className="space-y-2 rounded-md border border-border bg-background/40 p-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div className="font-medium text-foreground">
                              {index + 1}. {reel.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {reel.trendName} · {reel.durationSeconds.toFixed(1)}s · {reel.shots.length} shots
                            </div>
                          </div>
                          <div className="text-sm text-foreground">
                            <span className="text-muted-foreground">Sound to add: </span>
                            {reel.sound.title}
                            {reel.sound.artist ? ` — ${reel.sound.artist}` : ""}
                            <span className="text-muted-foreground">
                              {" "}
                              · cuts timed to {reel.bpm} BPM
                              {reel.sound.bpm ? "" : " (the sound's own tempo isn't known)"}
                            </span>
                          </div>
                          {reel.soundNote ? <div className="text-xs text-muted-foreground">{reel.soundNote}</div> : null}
                          {texts.length > 0 ? (
                            <div className="text-xs text-muted-foreground">On screen: {texts.join(" / ")}</div>
                          ) : null}
                          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                            {reel.caption}
                          </div>
                          <Button variant="secondary" size="sm" onClick={() => void copyCaption(reelKey, reel.caption)}>
                            {copied === reelKey ? "Copied" : "Copy Caption"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </CardContent>

              <CardFooter className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void startRun({ projectId: project.id, action: "resync" })}
                  disabled={submitting || isRunning(project.status)}
                >
                  Sync Again
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void startRun({ projectId: project.id, action: "replan" })}
                  disabled={submitting || isRunning(project.status) || project.summary === null}
                >
                  Regenerate with Fresh Trends
                </Button>
                {project.reels.length > 0 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.open(`/reels/${project.id}/reels.json`, "_blank")}
                  >
                    View reels.json
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          ))}

          {projects.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">No reels projects yet.</CardContent>
            </Card>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default ReelsWorkflow;
