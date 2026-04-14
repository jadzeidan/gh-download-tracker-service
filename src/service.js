import crypto from "node:crypto";
import { config, getRepoSlug } from "./config.js";
import { fetchAllReleases } from "./github.js";
import { classifyAsset } from "./platforms.js";
import { appendSyncRun, ensureStore, readStore } from "./store.js";
import {
  buildCurrentReleaseView,
  buildLatestPlatformTotals,
  buildPlatformHistory
} from "./aggregations.js";

function normalizeAssetSnapshots(releases, syncedAt) {
  const snapshots = [];

  for (const release of releases) {
    if (release.draft || release.prerelease) {
      continue;
    }

    for (const asset of release.assets ?? []) {
      const classification = classifyAsset(asset.name);

      if (!classification) {
        continue;
      }

      snapshots.push({
        syncedAt,
        releaseId: release.id,
        releaseTag: release.tag_name,
        releaseName: release.name,
        releasePublishedAt: release.published_at,
        releaseHtmlUrl: release.html_url,
        platform: classification.platform,
        distribution: classification.distribution,
        assetId: asset.id,
        assetName: asset.name,
        browserDownloadUrl: asset.browser_download_url,
        downloadCount: asset.download_count
      });
    }
  }

  return snapshots;
}

export async function initializeStore() {
  await ensureStore(config.dataFilePath, getRepoSlug());
}

export async function runSync() {
  const syncedAt = new Date().toISOString();
  const releases = await fetchAllReleases({
    githubToken: config.githubToken,
    owner: config.githubRepoOwner,
    repo: config.githubRepoName
  });

  const assetSnapshots = normalizeAssetSnapshots(releases, syncedAt);
  const syncRun = {
    id: crypto.randomUUID(),
    syncedAt,
    repo: getRepoSlug(),
    fetchedReleaseCount: releases.length,
    storedAssetSnapshotCount: assetSnapshots.length
  };

  await appendSyncRun(config.dataFilePath, syncRun, assetSnapshots);

  return {
    syncRun,
    summary: {
      releasesFetched: releases.length,
      assetSnapshotsStored: assetSnapshots.length
    }
  };
}

export async function getDashboardData({ releaseTag, platform } = {}) {
  const store = await readStore(config.dataFilePath);

  return {
    meta: store.meta,
    syncRuns: store.syncRuns,
    current: buildCurrentReleaseView(store.assetSnapshots),
    platformTotals: buildLatestPlatformTotals(store.assetSnapshots),
    history: buildPlatformHistory(store.assetSnapshots, { releaseTag, platform })
  };
}
