import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export type PhotosItem = {
  id: string;
  filename: string;
  date: string | null;
  favorite: boolean;
};

export type PhotosAlbum = {
  id: string;
  name: string;
  // Enclosing folders, outermost first.
  path: string[];
  count: number;
};

// Shared by both scripts: visits every album, including those nested in
// folders, calling visit(album, id, name, folderPath). Properties are fetched in
// bulk (`albums.id()` is one Apple Event per folder, not one per album).
const WALK_ALBUMS = `
const walkAlbums = (container, path, visit) => {
  const albums = container.albums;
  const ids = albums.id();
  const names = albums.name();
  for (let i = 0; i < ids.length; i++) visit(albums[i], ids[i], names[i], path);
  const folders = container.folders;
  const folderNames = folders.name();
  for (let i = 0; i < folderNames.length; i++) walkAlbums(folders[i], path.concat(folderNames[i]), visit);
};
`;

// Every album with its folder path and item count, for the album picker.
const LIST_ALBUMS_SCRIPT = `
${WALK_ALBUMS}
function run() {
  const albums = [];
  walkAlbums(Application("Photos"), [], (album, id, name, path) => {
    albums.push({ id: id, name: name, path: path, count: album.mediaItems.length });
  });
  return JSON.stringify({ albums: albums });
}
`;

// JXA, so the result comes back as JSON. Looks the album up by id when one is
// given (the picker's choice, unambiguous), otherwise by name, refusing to
// guess between albums that share one. Item properties are fetched in bulk
// (`mediaItems.id()` is one Apple Event for the whole album), which keeps large
// albums fast.
const LIST_ALBUM_SCRIPT = `
${WALK_ALBUMS}
function run(argv) {
  const name = argv[0];
  const albumId = argv[1];
  const Photos = Application("Photos");

  const matches = [];
  walkAlbums(Photos, [], (album, id, albumName, path) => {
    if (albumId ? id === albumId : albumName === name) {
      matches.push({ album: album, path: path.concat(albumName).join(" / ") });
    }
  });

  if (matches.length === 0) {
    return JSON.stringify({ error: "not-found", albums: Photos.albums.name().slice(0, 40) });
  }
  if (matches.length > 1) {
    return JSON.stringify({ error: "ambiguous", matches: matches.map((m) => m.path) });
  }

  const items = matches[0].album.mediaItems;
  const ids = items.id();
  const filenames = items.filename();
  const dates = items.date();
  const favorites = items.favorite();

  return JSON.stringify({
    items: ids.map((id, i) => ({
      id: id,
      filename: filenames[i],
      date: dates[i] ? dates[i].toISOString() : null,
      favorite: Boolean(favorites[i]),
    })),
  });
}
`;

export class PhotosAccessError extends Error {}

// osascript reports a refused Automation permission as error -1743.
const explainOsascriptError = (err: unknown): Error => {
  const message = err instanceof Error ? (err as Error & { stderr?: string }).stderr || err.message : String(err);

  if (message.includes("-1743") || /not allowed|not authori[sz]ed/i.test(message)) {
    return new PhotosAccessError(
      "macOS refused access to Photos. Allow it in System Settings → Privacy & Security → Automation (for the app running the dev server, e.g. Terminal or VS Code), then try again.",
    );
  }

  return new Error(`Photos scripting failed: ${message.trim()}`);
};

export const listPhotosAlbums = async (): Promise<PhotosAlbum[]> => {
  let stdout: string;
  try {
    ({ stdout } = await run("osascript", ["-l", "JavaScript", "-e", LIST_ALBUMS_SCRIPT], {
      maxBuffer: 16 * 1024 * 1024,
      timeout: 5 * 60 * 1000,
    }));
  } catch (err) {
    throw explainOsascriptError(err);
  }

  return (JSON.parse(stdout) as { albums: PhotosAlbum[] }).albums;
};

export const listPhotosAlbum = async (album: { name: string; id?: string }): Promise<PhotosItem[]> => {
  let stdout: string;
  try {
    ({ stdout } = await run("osascript", ["-l", "JavaScript", "-e", LIST_ALBUM_SCRIPT, album.name, album.id ?? ""], {
      maxBuffer: 64 * 1024 * 1024,
      timeout: 10 * 60 * 1000,
    }));
  } catch (err) {
    throw explainOsascriptError(err);
  }

  const result = JSON.parse(stdout) as {
    items?: PhotosItem[];
    error?: string;
    albums?: string[];
    matches?: string[];
  };

  if (result.error === "not-found") {
    throw new PhotosAccessError(
      album.id
        ? `The Photos album "${album.name}" no longer exists — it may have been deleted.`
        : `No Photos album named "${album.name}". Top-level albums include: ${(result.albums ?? []).join(", ") || "(none)"}.`,
    );
  }

  if (result.error === "ambiguous") {
    throw new PhotosAccessError(
      `Several Photos albums are named "${album.name}": ${(result.matches ?? []).join("; ")}. Choose the one you mean with Choose Album to Sync.`,
    );
  }

  return result.items ?? [];
};
