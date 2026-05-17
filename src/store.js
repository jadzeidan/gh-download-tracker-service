import fs from "node:fs/promises";
import path from "node:path";

const EMPTY_STORE = {
  meta: {
    version: 1,
    createdAt: null,
    updatedAt: null,
    repo: null
  },
  syncRuns: [],
  assetSnapshots: []
};

function normalizeStore(store) {
  const normalized = {
    meta:
      store?.meta && typeof store.meta === "object"
        ? { ...structuredClone(EMPTY_STORE.meta), ...store.meta }
        : structuredClone(EMPTY_STORE.meta),
    syncRuns: Array.isArray(store?.syncRuns) ? store.syncRuns : [],
    assetSnapshots: Array.isArray(store?.assetSnapshots) ? store.assetSnapshots : []
  };

  if (!normalized.meta.version) {
    normalized.meta.version = 1;
  }

  if (!normalized.meta.createdAt) {
    normalized.meta.createdAt = new Date().toISOString();
  }

  return normalized;
}

export async function ensureStore(filePath, repoSlug) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const initialStore = structuredClone(EMPTY_STORE);
    initialStore.meta.createdAt = new Date().toISOString();
    initialStore.meta.updatedAt = initialStore.meta.createdAt;
    initialStore.meta.repo = repoSlug;

    await writeStore(filePath, initialStore);
  }
}

export async function readStore(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return normalizeStore(JSON.parse(raw));
}

export async function writeStore(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function appendSyncRun(filePath, syncRun, assetSnapshots) {
  const store = await readStore(filePath);
  store.syncRuns.push(syncRun);
  store.assetSnapshots.push(...assetSnapshots);
  store.meta.updatedAt = syncRun.syncedAt;
  await writeStore(filePath, store);
  return store;
}
