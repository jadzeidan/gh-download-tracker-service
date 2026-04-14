export function buildCurrentReleaseView(assetSnapshots) {
  const latestByReleasePlatform = new Map();

  for (const snapshot of assetSnapshots) {
    const key = `${snapshot.releaseTag}:${snapshot.platform}`;
    const existing = latestByReleasePlatform.get(key);

    if (!existing || snapshot.syncedAt > existing.syncedAt) {
      latestByReleasePlatform.set(key, {
        releaseTag: snapshot.releaseTag,
        releaseName: snapshot.releaseName,
        releasePublishedAt: snapshot.releasePublishedAt,
        releaseHtmlUrl: snapshot.releaseHtmlUrl,
        platform: snapshot.platform,
        syncedAt: snapshot.syncedAt,
        totalDownloads: 0,
        distributions: {}
      });
    }
  }

  for (const snapshot of assetSnapshots) {
    const key = `${snapshot.releaseTag}:${snapshot.platform}`;
    const aggregate = latestByReleasePlatform.get(key);

    if (!aggregate || aggregate.syncedAt !== snapshot.syncedAt) {
      continue;
    }

    aggregate.totalDownloads += snapshot.downloadCount;
    aggregate.distributions[snapshot.distribution] =
      (aggregate.distributions[snapshot.distribution] ?? 0) + snapshot.downloadCount;
  }

  return Array.from(latestByReleasePlatform.values()).sort((left, right) => {
    if (left.releasePublishedAt === right.releasePublishedAt) {
      return left.platform.localeCompare(right.platform);
    }

    return right.releasePublishedAt.localeCompare(left.releasePublishedAt);
  });
}

export function buildPlatformHistory(assetSnapshots, { releaseTag, platform } = {}) {
  const filtered = assetSnapshots.filter((snapshot) => {
    if (releaseTag && snapshot.releaseTag !== releaseTag) {
      return false;
    }

    if (platform && snapshot.platform !== platform) {
      return false;
    }

    return true;
  });

  const grouped = new Map();

  for (const snapshot of filtered) {
    const key = `${snapshot.syncedAt}:${snapshot.releaseTag}:${snapshot.platform}`;
    const existing = grouped.get(key) ?? {
      syncedAt: snapshot.syncedAt,
      releaseTag: snapshot.releaseTag,
      releasePublishedAt: snapshot.releasePublishedAt,
      platform: snapshot.platform,
      totalDownloads: 0
    };

    existing.totalDownloads += snapshot.downloadCount;
    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).sort((left, right) => {
    if (left.syncedAt === right.syncedAt) {
      if (left.releasePublishedAt === right.releasePublishedAt) {
        return left.platform.localeCompare(right.platform);
      }

      return right.releasePublishedAt.localeCompare(left.releasePublishedAt);
    }

    return left.syncedAt.localeCompare(right.syncedAt);
  });
}

export function buildLatestPlatformTotals(assetSnapshots) {
  const currentReleaseView = buildCurrentReleaseView(assetSnapshots);
  const totals = new Map();

  for (const row of currentReleaseView) {
    totals.set(row.platform, (totals.get(row.platform) ?? 0) + row.totalDownloads);
  }

  return Array.from(totals.entries())
    .map(([platform, totalDownloads]) => ({ platform, totalDownloads }))
    .sort((left, right) => right.totalDownloads - left.totalDownloads);
}
