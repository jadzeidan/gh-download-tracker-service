import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { appendSyncRun, ensureStore, readStore, writeStore } from "../src/store.js";

function createSyncRun({ id, syncedAt }) {
  return {
    id,
    syncedAt,
    repo: "BitBoxSwiss/bitbox-wallet-app",
    fetchedReleaseCount: 1,
    storedAssetSnapshotCount: 1
  };
}

function createSnapshot({ syncedAt, releaseTag, downloadCount, releaseName }) {
  return {
    syncedAt,
    releaseId: 1,
    releaseTag,
    releaseName,
    releasePublishedAt: "2026-05-01T00:00:00Z",
    releaseHtmlUrl: "https://example.test/release",
    platform: "linux",
    distribution: "deb",
    assetId: 10,
    assetName: "bitbox.deb",
    browserDownloadUrl: "https://example.test/bitbox.deb",
    downloadCount
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

test("appendSyncRun writes compacted monthly chunk files and keeps all runs", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "downloads-store-"));
  const filePath = path.join(directory, "downloads.json");

  await ensureStore(filePath, "BitBoxSwiss/bitbox-wallet-app");

  const run1At = "2026-05-18T00:00:00.000Z";
  const run2At = "2026-06-02T03:00:00.000Z";

  await appendSyncRun(
    filePath,
    createSyncRun({ id: "run-1", syncedAt: run1At }),
    [
      createSnapshot({ syncedAt: run1At, releaseTag: "v1.0.0", releaseName: "v1.0.0", downloadCount: 10 }),
      {
        ...createSnapshot({ syncedAt: run1At, releaseTag: "v1.0.0", releaseName: "v1.0.0", downloadCount: 5 }),
        distribution: "rpm"
      }
    ]
  );

  await appendSyncRun(
    filePath,
    createSyncRun({ id: "run-2", syncedAt: run2At }),
    [createSnapshot({ syncedAt: run2At, releaseTag: "v1.0.1", downloadCount: 11 })]
  );

  const store = await readStore(filePath);
  const index = await readJson(filePath);
  const mayChunk = await readJson(path.join(directory, "snapshots", "2026-05.json"));

  assert.deepEqual(
    store.syncRuns.map((run) => run.id),
    ["run-1", "run-2"]
  );
  assert.equal(store.assetSnapshots.length, 3);
  assert.deepEqual(
    index.snapshotFiles.map((entry) => entry.month),
    ["2026-05", "2026-06"]
  );
  assert.equal(Array.isArray(index.assetSnapshots), false);
  assert.equal(mayChunk.assetSnapshots.length, 2);
  assert.equal(
    store.assetSnapshots.some((snapshot) => snapshot.releaseTag === "v1.0.1" && snapshot.releaseName === "v1.0.1"),
    true
  );
  assert.equal("browserDownloadUrl" in mayChunk.assetSnapshots[0], false);
  assert.equal("assetId" in mayChunk.assetSnapshots[0], false);
});

test("appendSyncRun migrates legacy monolithic file to chunked files", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "downloads-store-"));
  const filePath = path.join(directory, "downloads.json");
  const legacyRunAt = "2026-04-14T00:00:00.000Z";
  const newRunAt = "2026-05-18T00:00:00.000Z";

  await fs.writeFile(
    filePath,
    JSON.stringify({
      meta: {
        version: 1,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        repo: "BitBoxSwiss/bitbox-wallet-app"
      },
      syncRuns: [createSyncRun({ id: "run-legacy", syncedAt: legacyRunAt })],
      assetSnapshots: [
        createSnapshot({
          syncedAt: legacyRunAt,
          releaseTag: "v1.0.0",
          releaseName: "v1.0.0",
          downloadCount: 10
        })
      ]
    })
  );

  await appendSyncRun(filePath, createSyncRun({ id: "run-new", syncedAt: newRunAt }), [
    createSnapshot({
      syncedAt: newRunAt,
      releaseTag: "v1.1.0",
      releaseName: "v1.1.0",
      downloadCount: 12
    })
  ]);

  const index = await readJson(filePath);
  const store = await readStore(filePath);

  assert.equal(Array.isArray(index.assetSnapshots), false);
  assert.deepEqual(
    index.snapshotFiles.map((entry) => entry.month),
    ["2026-04", "2026-05"]
  );
  assert.deepEqual(
    store.syncRuns.map((run) => run.id),
    ["run-legacy", "run-new"]
  );
  assert.equal(store.assetSnapshots.length, 2);
});

test("writeStore writes compacted chunked store", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "downloads-store-"));
  const filePath = path.join(directory, "downloads.json");

  await writeStore(filePath, {
    meta: {
      version: 2,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
      repo: "BitBoxSwiss/bitbox-wallet-app"
    },
    syncRuns: [
      createSyncRun({ id: "run-1", syncedAt: "2026-05-01T00:00:00.000Z" })
    ],
    assetSnapshots: [
      createSnapshot({
        syncedAt: "2026-05-01T00:00:00.000Z",
        releaseTag: "v1.0.0",
        releaseName: "v1.0.0",
        downloadCount: 10
      })
    ]
  });

  const index = await readJson(filePath);
  assert.deepEqual(index.snapshotFiles.map((entry) => entry.month), ["2026-05"]);

  const store = await readStore(filePath);
  assert.deepEqual(Object.keys(store.assetSnapshots[0]).sort(), [
    "distribution",
    "downloadCount",
    "platform",
    "releaseHtmlUrl",
    "releaseName",
    "releasePublishedAt",
    "releaseTag",
    "syncedAt"
  ]);
});
