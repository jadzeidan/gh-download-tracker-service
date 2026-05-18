import fs from "node:fs/promises";
import path from "node:path";

const STORE_VERSION = 2;
const SNAPSHOT_DIRNAME = "snapshots";

const EMPTY_STORE_INDEX = {
  meta: {
    version: STORE_VERSION,
    createdAt: null,
    updatedAt: null,
    repo: null
  },
  syncRuns: [],
  snapshotFiles: []
};

const SNAPSHOT_KEYS = [
  "syncedAt",
  "releaseTag",
  "releaseName",
  "releasePublishedAt",
  "releaseHtmlUrl",
  "platform",
  "distribution",
  "downloadCount"
];

function normalizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const normalized = {};

  for (const key of SNAPSHOT_KEYS) {
    if (Object.hasOwn(snapshot, key)) {
      normalized[key] = snapshot[key];
    }
  }

  if (!normalized.releaseName && normalized.releaseTag) {
    normalized.releaseName = normalized.releaseTag;
  }

  if (typeof normalized.downloadCount !== "number") {
    return null;
  }

  return normalized;
}

function normalizeSnapshots(snapshots) {
  if (!Array.isArray(snapshots)) {
    return [];
  }

  const normalized = [];

  for (const snapshot of snapshots) {
    const compacted = normalizeSnapshot(snapshot);

    if (compacted) {
      normalized.push(compacted);
    }
  }

  return normalized;
}

function getMonthKey(value) {
  const stringValue = String(value ?? "");

  if (/^\d{4}-\d{2}$/.test(stringValue)) {
    return stringValue;
  }

  const isoMonthMatch = /^(\d{4}-\d{2})/.exec(stringValue);

  if (isoMonthMatch) {
    return isoMonthMatch[1];
  }

  const parsedDate = new Date(stringValue);

  if (!Number.isFinite(parsedDate.getTime())) {
    return null;
  }

  const year = String(parsedDate.getUTCFullYear());
  const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getSnapshotRelativePath(month) {
  return `${SNAPSHOT_DIRNAME}/${month}.json`;
}

function getSnapshotAbsolutePath(indexFilePath, relativePath) {
  return path.join(path.dirname(indexFilePath), ...relativePath.split("/"));
}

function normalizeSnapshotFileEntry(entry) {
  if (typeof entry === "string") {
    const month = getMonthKey(path.basename(entry, ".json"));

    if (!month) {
      return null;
    }

    return {
      month,
      file: entry.replaceAll("\\", "/"),
      snapshotCount: null
    };
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  const file = String(entry.file ?? "").replaceAll("\\", "/");
  const month = getMonthKey(entry.month ?? path.basename(file, ".json"));
  const snapshotCount =
    Number.isInteger(entry.snapshotCount) && entry.snapshotCount >= 0 ? entry.snapshotCount : null;

  if (!file || !month) {
    return null;
  }

  return {
    month,
    file,
    snapshotCount
  };
}

function normalizeStoreIndex(store) {
  const mergedMeta =
    store?.meta && typeof store.meta === "object"
      ? { ...structuredClone(EMPTY_STORE_INDEX.meta), ...store.meta }
      : structuredClone(EMPTY_STORE_INDEX.meta);

  const snapshotFileEntries = Array.isArray(store?.snapshotFiles)
    ? store.snapshotFiles
        .map((entry) => normalizeSnapshotFileEntry(entry))
        .filter(Boolean)
        .sort((left, right) => left.month.localeCompare(right.month))
    : [];

  const snapshotFilesByMonth = new Map();

  for (const entry of snapshotFileEntries) {
    snapshotFilesByMonth.set(entry.month, entry);
  }

  const normalized = {
    meta: mergedMeta,
    syncRuns: Array.isArray(store?.syncRuns) ? store.syncRuns : [],
    snapshotFiles: Array.from(snapshotFilesByMonth.values()).sort((left, right) =>
      left.month.localeCompare(right.month)
    )
  };

  normalized.meta.version = STORE_VERSION;

  if (!normalized.meta.createdAt) {
    normalized.meta.createdAt = new Date().toISOString();
  }

  return normalized;
}

function normalizeLegacyStore(store) {
  const mergedMeta =
    store?.meta && typeof store.meta === "object"
      ? { ...structuredClone(EMPTY_STORE_INDEX.meta), ...store.meta }
      : structuredClone(EMPTY_STORE_INDEX.meta);

  if (!mergedMeta.createdAt) {
    mergedMeta.createdAt = new Date().toISOString();
  }

  return {
    meta: mergedMeta,
    syncRuns: Array.isArray(store?.syncRuns) ? store.syncRuns : [],
    assetSnapshots: normalizeSnapshots(store?.assetSnapshots)
  };
}

function buildSnapshotsByMonth(assetSnapshots) {
  const snapshotsByMonth = new Map();

  for (const snapshot of normalizeSnapshots(assetSnapshots)) {
    const month = getMonthKey(snapshot.syncedAt);

    if (!month) {
      continue;
    }

    const monthSnapshots = snapshotsByMonth.get(month) ?? [];
    monthSnapshots.push(snapshot);
    snapshotsByMonth.set(month, monthSnapshots);
  }

  return snapshotsByMonth;
}

function buildSnapshotFileEntries(snapshotsByMonth) {
  return Array.from(snapshotsByMonth.entries())
    .sort(([leftMonth], [rightMonth]) => leftMonth.localeCompare(rightMonth))
    .map(([month, snapshots]) => ({
      month,
      file: getSnapshotRelativePath(month),
      snapshotCount: snapshots.length
    }));
}

function buildChunkedIndex({ meta, syncRuns, snapshotsByMonth }) {
  return normalizeStoreIndex({
    meta: {
      ...meta,
      version: STORE_VERSION
    },
    syncRuns,
    snapshotFiles: buildSnapshotFileEntries(snapshotsByMonth)
  });
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function readSnapshotFile(snapshotFilePath) {
  try {
    const raw = await readJson(snapshotFilePath);

    if (Array.isArray(raw)) {
      return normalizeSnapshots(raw);
    }

    return normalizeSnapshots(raw?.assetSnapshots);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeSnapshotFile(snapshotFilePath, month, snapshots) {
  await writeJson(snapshotFilePath, {
    month,
    assetSnapshots: normalizeSnapshots(snapshots)
  });
}

function isLegacyStoreShape(store) {
  return Array.isArray(store?.assetSnapshots);
}

async function readStoreIndexState(filePath) {
  const raw = await readJson(filePath);

  if (isLegacyStoreShape(raw)) {
    const legacyStore = normalizeLegacyStore(raw);
    const legacySnapshotsByMonth = buildSnapshotsByMonth(legacyStore.assetSnapshots);

    return {
      isLegacy: true,
      legacySnapshotsByMonth,
      index: buildChunkedIndex({
        meta: legacyStore.meta,
        syncRuns: legacyStore.syncRuns,
        snapshotsByMonth: legacySnapshotsByMonth
      })
    };
  }

  return {
    isLegacy: false,
    legacySnapshotsByMonth: new Map(),
    index: normalizeStoreIndex(raw)
  };
}

async function migrateLegacyStore(filePath, legacySnapshotsByMonth, index) {
  for (const [month, snapshots] of legacySnapshotsByMonth.entries()) {
    const relativePath = getSnapshotRelativePath(month);
    const snapshotFilePath = getSnapshotAbsolutePath(filePath, relativePath);
    await writeSnapshotFile(snapshotFilePath, month, snapshots);
  }

  await writeJson(filePath, index);
}

async function loadAllSnapshotsFromIndex(filePath, index) {
  const allSnapshots = [];

  for (const snapshotFile of index.snapshotFiles) {
    const snapshotFilePath = getSnapshotAbsolutePath(filePath, snapshotFile.file);
    const snapshots = await readSnapshotFile(snapshotFilePath);
    allSnapshots.push(...snapshots);
  }

  return allSnapshots;
}

function withUpdatedSnapshotFileEntry(index, month, snapshotCount) {
  const snapshotEntry = {
    month,
    file: getSnapshotRelativePath(month),
    snapshotCount
  };

  const nextSnapshotFiles = index.snapshotFiles.filter((entry) => entry.month !== month);
  nextSnapshotFiles.push(snapshotEntry);

  return {
    ...index,
    snapshotFiles: nextSnapshotFiles.sort((left, right) => left.month.localeCompare(right.month))
  };
}

export async function ensureStore(filePath, repoSlug) {
  try {
    await fs.access(filePath);
  } catch {
    const createdAt = new Date().toISOString();
    const initialStore = normalizeStoreIndex({
      meta: {
        version: STORE_VERSION,
        createdAt,
        updatedAt: createdAt,
        repo: repoSlug
      },
      syncRuns: [],
      snapshotFiles: []
    });

    await writeJson(filePath, initialStore);
  }
}

export async function readStore(filePath) {
  const { isLegacy, legacySnapshotsByMonth, index } = await readStoreIndexState(filePath);

  if (isLegacy) {
    const snapshots = Array.from(legacySnapshotsByMonth.entries())
      .sort(([leftMonth], [rightMonth]) => leftMonth.localeCompare(rightMonth))
      .flatMap(([, monthSnapshots]) => monthSnapshots);

    return {
      meta: index.meta,
      syncRuns: index.syncRuns,
      snapshotFiles: index.snapshotFiles,
      assetSnapshots: snapshots
    };
  }

  return {
    meta: index.meta,
    syncRuns: index.syncRuns,
    snapshotFiles: index.snapshotFiles,
    assetSnapshots: await loadAllSnapshotsFromIndex(filePath, index)
  };
}

export async function writeStore(filePath, data) {
  const normalizedSnapshots = normalizeSnapshots(data?.assetSnapshots);
  const snapshotsByMonth = buildSnapshotsByMonth(normalizedSnapshots);
  const normalizedStore = buildChunkedIndex({
    meta: data?.meta,
    syncRuns: Array.isArray(data?.syncRuns) ? data.syncRuns : [],
    snapshotsByMonth
  });

  const snapshotDirectory = path.join(path.dirname(filePath), SNAPSHOT_DIRNAME);
  await fs.rm(snapshotDirectory, { recursive: true, force: true });

  for (const [month, monthSnapshots] of snapshotsByMonth.entries()) {
    const relativePath = getSnapshotRelativePath(month);
    const snapshotFilePath = getSnapshotAbsolutePath(filePath, relativePath);
    await writeSnapshotFile(snapshotFilePath, month, monthSnapshots);
  }

  await writeJson(filePath, normalizedStore);
}

export async function appendSyncRun(filePath, syncRun, assetSnapshots) {
  const normalizedSnapshots = normalizeSnapshots(assetSnapshots);
  const snapshotsByMonth = buildSnapshotsByMonth(normalizedSnapshots);
  let { isLegacy, legacySnapshotsByMonth, index } = await readStoreIndexState(filePath);

  if (isLegacy) {
    await migrateLegacyStore(filePath, legacySnapshotsByMonth, index);
  }

  for (const [month, monthSnapshots] of snapshotsByMonth.entries()) {
    const existingEntry = index.snapshotFiles.find((entry) => entry.month === month);
    let existingSnapshots = [];

    if (isLegacy) {
      existingSnapshots = legacySnapshotsByMonth.get(month) ?? [];
    } else if (existingEntry) {
      const existingSnapshotPath = getSnapshotAbsolutePath(filePath, existingEntry.file);
      existingSnapshots = await readSnapshotFile(existingSnapshotPath);
    }

    const mergedSnapshots = [...existingSnapshots, ...monthSnapshots];
    const snapshotFilePath = getSnapshotAbsolutePath(filePath, getSnapshotRelativePath(month));
    await writeSnapshotFile(snapshotFilePath, month, mergedSnapshots);

    index = withUpdatedSnapshotFileEntry(index, month, mergedSnapshots.length);
  }

  index.syncRuns.push(syncRun);
  index.meta.updatedAt = syncRun.syncedAt;
  index.meta.version = STORE_VERSION;

  if (!index.meta.createdAt) {
    index.meta.createdAt = new Date().toISOString();
  }

  await writeJson(filePath, normalizeStoreIndex(index));
  return index;
}
