import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCurrentReleaseView,
  buildLatestPlatformTotals,
  buildPlatformHistory
} from "../src/aggregations.js";

const snapshots = [
  {
    syncedAt: "2026-04-14T00:00:00.000Z",
    releaseTag: "v4.50.1",
    releaseName: "v4.50.1",
    releasePublishedAt: "2026-01-27T16:12:29Z",
    releaseHtmlUrl: "https://example.test/v4.50.1",
    platform: "linux",
    distribution: "deb",
    downloadCount: 100
  },
  {
    syncedAt: "2026-04-14T00:00:00.000Z",
    releaseTag: "v4.50.1",
    releaseName: "v4.50.1",
    releasePublishedAt: "2026-01-27T16:12:29Z",
    releaseHtmlUrl: "https://example.test/v4.50.1",
    platform: "linux",
    distribution: "rpm",
    downloadCount: 10
  },
  {
    syncedAt: "2026-04-15T00:00:00.000Z",
    releaseTag: "v4.50.1",
    releaseName: "v4.50.1",
    releasePublishedAt: "2026-01-27T16:12:29Z",
    releaseHtmlUrl: "https://example.test/v4.50.1",
    platform: "linux",
    distribution: "deb",
    downloadCount: 120
  },
  {
    syncedAt: "2026-04-15T00:00:00.000Z",
    releaseTag: "v4.50.1",
    releaseName: "v4.50.1",
    releasePublishedAt: "2026-01-27T16:12:29Z",
    releaseHtmlUrl: "https://example.test/v4.50.1",
    platform: "linux",
    distribution: "rpm",
    downloadCount: 12
  },
  {
    syncedAt: "2026-04-15T00:00:00.000Z",
    releaseTag: "v4.50.1",
    releaseName: "v4.50.1",
    releasePublishedAt: "2026-01-27T16:12:29Z",
    releaseHtmlUrl: "https://example.test/v4.50.1",
    platform: "windows",
    distribution: "exe",
    downloadCount: 300
  }
];

test("buildCurrentReleaseView keeps the latest snapshot per release and platform", () => {
  const current = buildCurrentReleaseView(snapshots);
  const linux = current.find((item) => item.platform === "linux");

  assert.equal(linux.totalDownloads, 132);
  assert.deepEqual(linux.distributions, { deb: 120, rpm: 12 });
});

test("buildPlatformHistory returns time-series totals", () => {
  const history = buildPlatformHistory(snapshots, { platform: "linux" });

  assert.deepEqual(history.map((row) => row.totalDownloads), [110, 132]);
});

test("buildLatestPlatformTotals sums the current release view per platform", () => {
  const totals = buildLatestPlatformTotals(snapshots);

  assert.deepEqual(totals, [
    { platform: "windows", totalDownloads: 300 },
    { platform: "linux", totalDownloads: 132 }
  ]);
});
