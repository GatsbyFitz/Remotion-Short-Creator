import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

// The shared library of everything the workflows have looked at: album photos
// and clips, and frames of the long videos. One SQLite file for every project,
// so analysis is paid for once per piece of media and is searchable across all
// of them.
//
// Media is identified by content, not by filename or project: an album photo
// by a hash of the file, a video frame by its source video's hash plus the
// timestamp. The same photo in two albums, or a video uploaded twice, reuses
// the analysis it already has.

// node:sqlite ships with Node 22.5+, but this project's @types/node predates it,
// and loading it at runtime keeps bundlers from trying to resolve it. Only the
// parts used here are typed.
type SqliteValue = null | number | bigint | string | Uint8Array;
type Row = Record<string, SqliteValue>;
type StatementSync = {
  run(...params: SqliteValue[]): unknown;
  get(...params: SqliteValue[]): Row | undefined;
  all(...params: SqliteValue[]): Row[];
};
type DatabaseSync = { exec(sql: string): void; prepare(sql: string): StatementSync };

const openDatabase = (file: string): DatabaseSync => {
  const { DatabaseSync } = (
    process as unknown as { getBuiltinModule(id: string): { DatabaseSync: new (file: string) => DatabaseSync } }
  ).getBuiltinModule("node:sqlite");
  return new DatabaseSync(file);
};

export const EMBEDDING_MODEL = "text-embedding-3-small";

// Appended to, never edited: each entry runs once, tracked by user_version.
const MIGRATIONS = [
  `
  CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('photo', 'video', 'frame')),
    created_at TEXT NOT NULL
  );

  -- One row per asset per analyzer. The analyzer id carries a version, so
  -- changing a prompt means a new id and fresh analysis, not stale cache hits.
  CREATE TABLE analyses (
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    analyzer TEXT NOT NULL,
    model TEXT NOT NULL,
    description TEXT NOT NULL,
    score REAL NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    PRIMARY KEY (asset_id, analyzer)
  );

  -- Where an asset appears. One photo can be in several reels projects.
  -- image is a path under public/ to show it by.
  CREATE TABLE locations (
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    project_type TEXT NOT NULL CHECK (project_type IN ('video', 'reels')),
    project_id TEXT NOT NULL,
    media_id TEXT NOT NULL DEFAULT '',
    second REAL,
    image TEXT NOT NULL,
    PRIMARY KEY (asset_id, project_type, project_id, media_id)
  );
  CREATE INDEX locations_by_project ON locations (project_type, project_id);

  -- Unit-length float32 vectors of each analysis's description.
  CREATE TABLE embeddings (
    asset_id TEXT NOT NULL,
    analyzer TEXT NOT NULL,
    model TEXT NOT NULL,
    vector BLOB NOT NULL,
    PRIMARY KEY (asset_id, analyzer),
    FOREIGN KEY (asset_id, analyzer) REFERENCES analyses (asset_id, analyzer) ON DELETE CASCADE
  );
  `,
];

const transaction = <T>(db: DatabaseSync, work: () => T): T => {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
};

// Kept on globalThis so dev-mode hot reloads reuse one connection.
const cache = globalThis as unknown as { analysisDb?: DatabaseSync };

export const analysisDb = (): DatabaseSync => {
  if (cache.analysisDb) return cache.analysisDb;

  const file = process.env.ANALYSIS_DB_PATH ?? path.join(process.cwd(), "data", "analysis.sqlite");
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = openDatabase(file);
  // WAL plus a busy timeout lets the dev server and one-off scripts share the file.
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

  const version = Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
  for (let i = version; i < MIGRATIONS.length; i += 1) {
    transaction(db, () => {
      db.exec(MIGRATIONS[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
    });
  }

  cache.analysisDb = db;
  return db;
};

const SAMPLE_BYTES = 4 * 1024 * 1024;

// The exact size plus the start, middle and end of the file, rather than all
// of it: source videos run to tens of GB, and three 4MB samples are plenty to
// tell real media files apart. Small files are hashed whole.
export const contentKey = (file: string): string => {
  const { size } = fs.statSync(file);
  const hash = crypto.createHash("sha256").update(String(size));
  const whole = size <= SAMPLE_BYTES * 3;
  const length = whole ? size : SAMPLE_BYTES;
  const offsets = whole ? [0] : [0, Math.floor(size / 2 - SAMPLE_BYTES / 2), size - SAMPLE_BYTES];
  const buffer = new Uint8Array(length);
  const fd = fs.openSync(file, "r");

  try {
    for (const offset of offsets) {
      const read = fs.readSync(fd, buffer, 0, length, offset);
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(fd);
  }

  return hash.digest("hex").slice(0, 32);
};

export const mediaAssetId = (key: string) => `media:${key}`;
export const frameAssetId = (videoKey: string, second: number) => `frame:${videoKey}@${second.toFixed(2)}`;

export type AssetKind = "photo" | "video" | "frame";

export type StoredAnalysis = {
  assetId: string;
  analyzer: string;
  model: string;
  description: string;
  score: number;
  data: Record<string, unknown>;
};

// SQLite caps bound parameters per statement; lookups go in chunks well under it.
const CHUNK = 500;

const chunks = <T>(items: T[]) =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK));

const toAnalysis = (row: Row): StoredAnalysis => ({
  assetId: String(row.asset_id),
  analyzer: String(row.analyzer),
  model: String(row.model),
  description: String(row.description),
  score: Number(row.score),
  data: JSON.parse(String(row.data)) as Record<string, unknown>,
});

export const getAnalyses = (analyzer: string, assetIds: string[]): Map<string, StoredAnalysis> => {
  const db = analysisDb();
  const found = new Map<string, StoredAnalysis>();

  for (const ids of chunks([...new Set(assetIds)])) {
    const rows = db
      .prepare(`SELECT * FROM analyses WHERE analyzer = ? AND asset_id IN (${ids.map(() => "?").join(",")})`)
      .all(analyzer, ...ids);
    for (const row of rows) {
      const analysis = toAnalysis(row);
      found.set(analysis.assetId, analysis);
    }
  }

  return found;
};

export const saveAnalyses = (rows: Array<StoredAnalysis & { kind: AssetKind }>) => {
  if (rows.length === 0) return;

  const db = analysisDb();
  const now = new Date().toISOString();
  const insertAsset = db.prepare("INSERT INTO assets (id, kind, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING");
  const upsertAnalysis = db.prepare(`
    INSERT INTO analyses (asset_id, analyzer, model, description, score, data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (asset_id, analyzer) DO UPDATE SET
      model = excluded.model, description = excluded.description, score = excluded.score,
      data = excluded.data, created_at = excluded.created_at
  `);
  // A rewritten description needs a fresh embedding.
  const dropEmbedding = db.prepare("DELETE FROM embeddings WHERE asset_id = ? AND analyzer = ?");

  transaction(db, () => {
    for (const row of rows) {
      insertAsset.run(row.assetId, row.kind, now);
      upsertAnalysis.run(row.assetId, row.analyzer, row.model, row.description, row.score, JSON.stringify(row.data), now);
      dropEmbedding.run(row.assetId, row.analyzer);
    }
  });
};

export type AssetLocation = {
  assetId: string;
  projectType: "video" | "reels";
  projectId: string;
  mediaId?: string;
  second?: number | null;
  image: string;
};

// Only records locations for assets already in the library; analysis is saved first.
export const saveLocations = (rows: AssetLocation[]) => {
  if (rows.length === 0) return;

  const db = analysisDb();
  const upsert = db.prepare(`
    INSERT INTO locations (asset_id, project_type, project_id, media_id, second, image)
    SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM assets WHERE id = ?)
    ON CONFLICT (asset_id, project_type, project_id, media_id) DO UPDATE SET
      second = excluded.second, image = excluded.image
  `);

  transaction(db, () => {
    for (const row of rows) {
      upsert.run(
        row.assetId,
        row.projectType,
        row.projectId,
        row.mediaId ?? "",
        row.second ?? null,
        row.image,
        row.assetId,
      );
    }
  });
};

// For re-imports, whose media ids no longer point at the same files.
export const clearProjectLocations = (projectType: AssetLocation["projectType"], projectId: string) => {
  analysisDb().prepare("DELETE FROM locations WHERE project_type = ? AND project_id = ?").run(projectType, projectId);
};

const normalize = (vector: number[]): Float32Array => {
  const length = Math.hypot(...vector) || 1;
  return Float32Array.from(vector, (v) => v / length);
};

const toVector = (blob: SqliteValue): Float32Array => {
  const bytes = blob as Uint8Array;
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};

// Embeds every analysis that doesn't have a vector yet. Called after each
// analysis pass, and again before every search so a failed embedding call
// earlier never leaves assets permanently unsearchable.
export const embedMissing = async (limit = 2000): Promise<number> => {
  const db = analysisDb();
  const rows = db
    .prepare(`
      SELECT a.asset_id, a.analyzer, a.description FROM analyses a
      LEFT JOIN embeddings e ON e.asset_id = a.asset_id AND e.analyzer = a.analyzer AND e.model = ?
      WHERE e.asset_id IS NULL
      LIMIT ?
    `)
    .all(EMBEDDING_MODEL, limit);

  if (rows.length === 0) return 0;

  const { embeddings } = await embedMany({
    model: openai.embedding(EMBEDDING_MODEL),
    values: rows.map((row) => String(row.description)),
    maxParallelCalls: 2,
  });

  const upsert = db.prepare(`
    INSERT INTO embeddings (asset_id, analyzer, model, vector) VALUES (?, ?, ?, ?)
    ON CONFLICT (asset_id, analyzer) DO UPDATE SET model = excluded.model, vector = excluded.vector
  `);

  transaction(db, () => {
    rows.forEach((row, i) => {
      const vector = normalize(embeddings[i]);
      upsert.run(row.asset_id, row.analyzer, EMBEDDING_MODEL, new Uint8Array(vector.buffer));
    });
  });

  return rows.length;
};

export type SearchResult = {
  assetId: string;
  kind: AssetKind;
  analyzer: string;
  description: string;
  score: number;
  similarity: number;
  locations: Array<Omit<AssetLocation, "assetId">>;
};

// Semantic search over every description in the library. A brute-force scan:
// even every frame of every project is a few thousand vectors.
export const searchAssets = async (query: string, limit = 24): Promise<SearchResult[]> => {
  try {
    await embedMissing();
  } catch (err) {
    console.warn("Couldn't embed new analyses before searching:", err instanceof Error ? err.message : err);
  }

  const db = analysisDb();
  const { embedding } = await embed({ model: openai.embedding(EMBEDDING_MODEL), value: query });
  const target = normalize(embedding);

  const rows = db
    .prepare(`
      SELECT e.asset_id, e.analyzer, e.vector, a.description, a.score, s.kind FROM embeddings e
      JOIN analyses a ON a.asset_id = e.asset_id AND a.analyzer = e.analyzer
      JOIN assets s ON s.id = e.asset_id
      WHERE e.model = ?
    `)
    .all(EMBEDDING_MODEL);

  // An asset analysed by more than one analyzer keeps its best match.
  const best = new Map<string, Omit<SearchResult, "locations">>();
  for (const row of rows) {
    const vector = toVector(row.vector);
    let similarity = 0;
    for (let i = 0; i < vector.length; i += 1) similarity += vector[i] * target[i];

    const assetId = String(row.asset_id);
    if ((best.get(assetId)?.similarity ?? -Infinity) < similarity) {
      best.set(assetId, {
        assetId,
        kind: String(row.kind) as AssetKind,
        analyzer: String(row.analyzer),
        description: String(row.description),
        score: Number(row.score),
        similarity,
      });
    }
  }

  const top = [...best.values()].sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  const locations = db.prepare("SELECT * FROM locations WHERE asset_id = ?");

  return top.map((result) => ({
    ...result,
    locations: locations.all(result.assetId).map((row) => ({
      projectType: String(row.project_type) as AssetLocation["projectType"],
      projectId: String(row.project_id),
      mediaId: String(row.media_id) || undefined,
      second: row.second === null ? null : Number(row.second),
      image: String(row.image),
    })),
  }));
};

export const libraryStats = () => {
  const db = analysisDb();
  const count = (sql: string) => Number(db.prepare(sql).get()?.n ?? 0);

  return {
    frames: count("SELECT count(*) AS n FROM assets WHERE kind = 'frame'"),
    photos: count("SELECT count(*) AS n FROM assets WHERE kind = 'photo'"),
    videos: count("SELECT count(*) AS n FROM assets WHERE kind = 'video'"),
    analyses: count("SELECT count(*) AS n FROM analyses"),
    embedded: count(`SELECT count(*) AS n FROM embeddings WHERE model = '${EMBEDDING_MODEL}'`),
  };
};

export const indexedCounts = (projectType: AssetLocation["projectType"]): Map<string, number> =>
  new Map(
    analysisDb()
      .prepare("SELECT project_id, count(*) AS n FROM locations WHERE project_type = ? GROUP BY project_id")
      .all(projectType)
      .map((row) => [String(row.project_id), Number(row.n)]),
  );
