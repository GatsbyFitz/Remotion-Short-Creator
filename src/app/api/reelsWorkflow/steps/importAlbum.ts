import fs from "fs";
import path from "node:path";
import { FatalError } from "workflow";
import { mapWithConcurrency } from "../../../../lib/mapWithConcurrency";
import { contentKey } from "../../../../lib/analysisDb";
import { importPhoto, importVideo, mediaKind } from "./mediaTools";
import { PhotosAccessError, PhotosItem, listPhotosAlbum } from "./photosAlbum";
import { ICLOUD_DOWNLOAD_HINT, PhotosExport, exportPhotosItems, isICloudDownloadError } from "./photosHelper";
import {
  MediaItem,
  MediaManifest,
  ReelProjectMetadata,
  readJson,
  reelDir,
  reelPath,
  setStatus,
  writeJson,
} from "./reelsShared";

// Caps the import and the analysis cost. A reel uses a dozen or so shots, so a
// bigger album only adds near-duplicates.
const MAX_MEDIA = 120;

// Conversions in flight at once.
const CONVERT_CONCURRENCY = 4;

type SourceFile = { path: string; originalName: string; takenAt: string | null; favorite: boolean };
type Sources = { files: SourceFile[]; skipped: MediaManifest["skipped"] };

// Every item up to the cap: favourites first, then the rest spread evenly
// through the album, finally put back in the order they were taken.
const chooseItems = <T extends { favorite: boolean }>(items: T[], max: number): T[] => {
  if (items.length <= max) return items;

  const favorites = items.filter((i) => i.favorite).slice(0, max);
  const rest = items.filter((i) => !i.favorite);
  const room = max - favorites.length;
  const spread = Array.from({ length: room }, (_, i) => rest[Math.floor((i * rest.length) / room)]);
  const chosen = new Set([...favorites, ...spread]);

  return items.filter((i) => chosen.has(i));
};

const fromPhotos = async (project: string, source: { album: string; albumId?: string }): Promise<Sources> => {
  const album = source.album;
  let items: PhotosItem[];
  try {
    items = await listPhotosAlbum({ name: source.album, id: source.albumId });
  } catch (err) {
    // A missing album or a refused permission won't fix itself on retry.
    if (err instanceof PhotosAccessError) throw new FatalError(err.message);
    throw err;
  }

  if (items.length === 0) {
    throw new FatalError(`The Photos album "${album}" is empty.`);
  }

  const chosen = chooseItems(
    [...items].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    MAX_MEDIA,
  );

  const exportDir = path.resolve(reelPath(project, "export"));
  fs.rmSync(exportDir, { recursive: true, force: true });
  fs.mkdirSync(exportDir, { recursive: true });

  let exported: PhotosExport;
  try {
    exported = await exportPhotosItems(
      chosen.map((i) => i.id),
      exportDir,
    );
  } catch (err) {
    if (err instanceof PhotosAccessError) throw new FatalError(err.message);
    throw err;
  }

  const fromICloud = exported.failures.filter((f) => isICloudDownloadError(f.error));

  // Nothing came out and it's iCloud's doing: say what to change, rather than
  // retrying into the same wall.
  if (exported.files.size === 0 && fromICloud.length > 0) {
    throw new FatalError(`All ${fromICloud.length} items in "${album}" are ${ICLOUD_DOWNLOAD_HINT}`);
  }

  // The helper reports the file it wrote for each item id, so there's no
  // guessing from filenames.
  const names = new Map(chosen.map((item) => [item.id, item.filename]));
  return {
    files: chosen.flatMap((item) => {
      const file = exported.files.get(item.id);
      return file ? [{ path: file, originalName: item.filename, takenAt: item.date, favorite: item.favorite }] : [];
    }),
    skipped: exported.failures.map((f) => ({
      name: names.get(f.id) ?? f.id,
      reason: isICloudDownloadError(f.error) ? `Only in iCloud and couldn't be downloaded` : f.error,
    })),
  };
};

const fromFolder = (folder: string): Sources => {
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    throw new FatalError(`Folder not found: ${folder}`);
  }

  const files = fs
    .readdirSync(folder)
    .filter((f) => !f.startsWith(".") && mediaKind(f) !== null)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => ({ path: path.join(folder, f), originalName: f, takenAt: null, favorite: false }));

  return { files: chooseItems(files, MAX_MEDIA), skipped: [] };
};

// Pulls the album's photos and clips into the project, converted into formats
// the renderer can use, with small thumbnails for the analysis pass.
export async function importAlbum(project: string) {
  "use step";

  const metadata = readJson<ReelProjectMetadata>(reelPath(project, "metadata.json"));
  setStatus(project, "importing");

  const { files: sources, skipped } =
    metadata.source.kind === "photos"
      ? await fromPhotos(project, metadata.source)
      : fromFolder(metadata.source.folder);

  if (sources.length === 0) {
    throw new FatalError("No photos or videos found to import.");
  }

  // Cleared first so a retried step doesn't leave stale files behind.
  const mediaDir = reelPath(project, "media");
  const thumbsDir = reelPath(project, "thumbs");
  for (const dir of [mediaDir, thumbsDir]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }

  const relative = (file: string) => path.relative(reelDir(project), file);

  const imported = await mapWithConcurrency(sources, CONVERT_CONCURRENCY, async (source, index) => {
    const id = `m${String(index + 1).padStart(3, "0")}`;
    const kind = mediaKind(source.path);

    try {
      const result: {
        file: string;
        width: number;
        height: number;
        duration?: number;
        thumbs: Array<{ file: string; second?: number }>;
      } =
        kind === "video"
          ? await importVideo(source.path, mediaDir, thumbsDir, id)
          : await importPhoto(source.path, mediaDir, thumbsDir, id);

      const item: MediaItem = {
        id,
        file: relative(result.file),
        kind: kind === "video" ? "video" : "photo",
        width: result.width,
        height: result.height,
        ...(result.duration !== undefined ? { duration: Math.round(result.duration * 100) / 100 } : {}),
        takenAt: source.takenAt,
        favorite: source.favorite,
        originalName: source.originalName,
        contentKey: contentKey(source.path),
        thumbs: result.thumbs.map((t) => ({ ...t, file: relative(t.file) })),
      };
      return item;
    } catch (err) {
      // One unreadable file shouldn't sink the album.
      skipped.push({ name: source.originalName, reason: err instanceof Error ? err.message : String(err) });
      return null;
    }
  });

  const items = imported.filter((item): item is MediaItem => item !== null);

  if (items.length === 0) {
    throw new FatalError(`None of the ${sources.length} files could be converted: ${skipped[0]?.reason ?? "unknown error"}`);
  }

  writeJson(reelPath(project, "media-manifest.json"), { items, skipped } satisfies MediaManifest);

  // The exported originals are converted copies by now.
  fs.rmSync(reelPath(project, "export"), { recursive: true, force: true });

  console.log(
    `Reels import: ${items.length} items (${items.filter((i) => i.kind === "video").length} videos), ${skipped.length} skipped.`,
  );

  return { imported: items.length, skipped: skipped.length };
}
