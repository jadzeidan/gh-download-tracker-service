const platformColors = {
  windows: "#155eef",
  macos: "#e65c2b",
  linux: "#14866d",
  android: "#6f9f1c"
};

const platformDescriptions = {
  windows: "Installer downloads",
  macos: "DMG and ZIP downloads",
  linux: "DEB, RPM, and AppImage downloads",
  android: "Direct APK downloads"
};

const repoNameEl = document.querySelector("#repo-name");
const latestSyncEl = document.querySelector("#latest-sync");
const platformGridEl = document.querySelector("#platform-grid");
const barListEl = document.querySelector("#bar-list");
const releaseFilterEl = document.querySelector("#release-filter");
const platformFilterEl = document.querySelector("#platform-filter");
const historySummaryEl = document.querySelector("#history-summary");
const currentTableEl = document.querySelector("#current-table");
const platformHistoryChartEl = document.querySelector("#platform-history-chart");
const platformHistoryLegendEl = document.querySelector("#platform-history-legend");
const platformHistorySummaryEl = document.querySelector("#platform-history-summary");
const historyChartEl = document.querySelector("#history-chart");
const chartLegendEl = document.querySelector("#chart-legend");
const deltaHistoryChartEl = document.querySelector("#delta-history-chart");
const deltaHistoryLegendEl = document.querySelector("#delta-history-legend");
const deltaHistorySummaryEl = document.querySelector("#delta-history-summary");
const filtersFormEl = document.querySelector("#filters-form");

let dashboardData = null;

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSignedNumber(value) {
  if (value > 0) {
    return `+${formatNumber(value)}`;
  }

  if (value < 0) {
    return `-${formatNumber(Math.abs(value))}`;
  }

  return "0";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-CH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function createStatus(message) {
  return `<div class="status">${message}</div>`;
}

function buildCurrentFromStore(assetSnapshots) {
  const latestRows = new Map();

  for (const snapshot of assetSnapshots) {
    const key = `${snapshot.releaseTag}:${snapshot.platform}`;
    const existing = latestRows.get(key);

    if (!existing || snapshot.syncedAt > existing.syncedAt) {
      latestRows.set(key, {
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
    const current = latestRows.get(key);

    if (!current || current.syncedAt !== snapshot.syncedAt) {
      continue;
    }

    current.totalDownloads += snapshot.downloadCount;
    current.distributions[snapshot.distribution] =
      (current.distributions[snapshot.distribution] ?? 0) + snapshot.downloadCount;
  }

  return Array.from(latestRows.values()).sort((left, right) => {
    if (left.releasePublishedAt === right.releasePublishedAt) {
      return left.platform.localeCompare(right.platform);
    }

    return right.releasePublishedAt.localeCompare(left.releasePublishedAt);
  });
}

function buildPlatformTotalsFromStore(assetSnapshots) {
  const current = buildCurrentFromStore(assetSnapshots);
  const totals = new Map();

  for (const row of current) {
    totals.set(row.platform, (totals.get(row.platform) ?? 0) + row.totalDownloads);
  }

  return Array.from(totals.entries())
    .map(([platform, totalDownloads]) => ({ platform, totalDownloads }))
    .sort((left, right) => right.totalDownloads - left.totalDownloads);
}

function buildHistoryFromStore(assetSnapshots) {
  const grouped = new Map();

  for (const snapshot of assetSnapshots) {
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

function buildPlatformTrendFromStore(assetSnapshots) {
  const grouped = new Map();

  for (const snapshot of assetSnapshots) {
    const key = `${snapshot.syncedAt}:${snapshot.platform}`;
    const existing = grouped.get(key) ?? {
      syncedAt: snapshot.syncedAt,
      platform: snapshot.platform,
      totalDownloads: 0
    };

    existing.totalDownloads += snapshot.downloadCount;
    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).sort((left, right) => {
    if (left.syncedAt === right.syncedAt) {
      return left.platform.localeCompare(right.platform);
    }

    return left.syncedAt.localeCompare(right.syncedAt);
  });
}

function populateFilters(data) {
  const previousRelease = releaseFilterEl.value;
  const previousPlatform = platformFilterEl.value;
  const releases = [...new Set(data.current.map((item) => item.releaseTag))];
  const platforms = [...new Set(data.current.map((item) => item.platform))];

  releaseFilterEl.innerHTML =
    '<option value="">All releases</option>' +
    releases.map((release) => `<option value="${release}">${release}</option>`).join("");

  platformFilterEl.innerHTML =
    '<option value="">All platforms</option>' +
    platforms.map((platform) => `<option value="${platform}">${platform}</option>`).join("");

  if (previousRelease && releases.includes(previousRelease)) {
    releaseFilterEl.value = previousRelease;
  } else if (!releaseFilterEl.dataset.initialized && releases.length) {
    releaseFilterEl.value = releases[0];
  }

  if (previousPlatform && platforms.includes(previousPlatform)) {
    platformFilterEl.value = previousPlatform;
  } else if (!platformFilterEl.dataset.initialized && platforms.length) {
    platformFilterEl.value = platforms.includes("windows") ? "windows" : platforms[0];
  }

  releaseFilterEl.dataset.initialized = "true";
  platformFilterEl.dataset.initialized = "true";
}

function renderPlatformCards(data) {
  if (!data.platformTotals.length) {
    platformGridEl.innerHTML = createStatus("No platform totals yet.");
    return;
  }

  platformGridEl.innerHTML = data.platformTotals
    .map(
      (item) => `
        <article class="platform-card ${item.platform}">
          <h3>${item.platform}</h3>
          <p class="value">${formatNumber(item.totalDownloads)}</p>
          <p class="subtext">${platformDescriptions[item.platform] ?? "Release downloads"}</p>
        </article>
      `
    )
    .join("");
}

function renderBarList(data) {
  if (!data.platformTotals.length) {
    barListEl.innerHTML = createStatus("No totals available.");
    return;
  }

  const max = Math.max(...data.platformTotals.map((item) => item.totalDownloads), 1);

  barListEl.innerHTML = data.platformTotals
    .map((item) => {
      const width = (item.totalDownloads / max) * 100;

      return `
        <div class="bar-row">
          <header>
            <span>${item.platform}</span>
            <span>${formatNumber(item.totalDownloads)}</span>
          </header>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%; background:${platformColors[item.platform]};"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderCurrentTable(data) {
  if (!data.current.length) {
    currentTableEl.innerHTML = `<tr><td colspan="5">No release data available.</td></tr>`;
    return;
  }

  currentTableEl.innerHTML = data.current
    .map((item) => {
      const breakdown = Object.entries(item.distributions)
        .map(([distribution, value]) => `<span class="pill">${distribution}: ${formatNumber(value)}</span>`)
        .join("");

      return `
        <tr>
          <td><a class="release-link" href="${item.releaseHtmlUrl}" target="_blank" rel="noreferrer">${item.releaseTag}</a></td>
          <td>${formatDate(item.releasePublishedAt)}</td>
          <td>${item.platform}</td>
          <td>${formatNumber(item.totalDownloads)}</td>
          <td><div class="pill-group">${breakdown}</div></td>
        </tr>
      `;
    })
    .join("");
}

function getFilteredHistory(data) {
  const selectedPlatform = platformFilterEl.value;
  const selectedRelease = releaseFilterEl.value;

  return data.history.filter((item) => {
    if (selectedPlatform && item.platform !== selectedPlatform) {
      return false;
    }

    if (selectedRelease && item.releaseTag !== selectedRelease) {
      return false;
    }

    return true;
  });
}

function buildPointDeltaHistory(items, seriesKey) {
  const pointsBySeries = new Map();

  for (const item of items) {
    const key = seriesKey(item);
    const series = pointsBySeries.get(key) ?? [];
    series.push(item);
    pointsBySeries.set(key, series);
  }

  const deltaRows = [];

  for (const seriesRows of pointsBySeries.values()) {
    const sortedSeriesRows = [...seriesRows].sort((left, right) => left.syncedAt.localeCompare(right.syncedAt));

    for (let index = 0; index < sortedSeriesRows.length; index += 1) {
      const current = sortedSeriesRows[index];
      const previous = sortedSeriesRows[index - 1];

      deltaRows.push({
        ...current,
        totalDownloads: previous ? current.totalDownloads - previous.totalDownloads : 0
      });
    }
  }

  return deltaRows.sort((left, right) => {
    if (left.syncedAt === right.syncedAt) {
      if (left.releasePublishedAt === right.releasePublishedAt) {
        return left.platform.localeCompare(right.platform);
      }

      return (right.releasePublishedAt ?? "").localeCompare(left.releasePublishedAt ?? "");
    }

    return left.syncedAt.localeCompare(right.syncedAt);
  });
}

function summarizeHistory(items) {
  if (!items.length) {
    historySummaryEl.textContent = "No matching history for the selected filters yet.";
    return;
  }

  const syncRuns = new Set(items.map((item) => item.syncedAt)).size;
  const earliest = items[0];
  const latest = items[items.length - 1];

  historySummaryEl.textContent =
    `Showing ${items.length} history points across ${syncRuns} sync run${syncRuns === 1 ? "" : "s"}. ` +
    `Earliest point: ${earliest.releaseTag} ${earliest.platform} at ${formatNumber(earliest.totalDownloads)}. ` +
    `Latest point: ${latest.releaseTag} ${latest.platform} at ${formatNumber(latest.totalDownloads)}.`;
}

function summarizePlatformTrend(items) {
  if (!platformHistorySummaryEl) {
    return;
  }

  if (!items.length) {
    platformHistorySummaryEl.textContent = "No platform trend data available yet.";
    return;
  }

  const syncRuns = new Set(items.map((item) => item.syncedAt)).size;
  const latestSync = items[items.length - 1].syncedAt;
  const latestRows = items.filter((item) => item.syncedAt === latestSync);
  const leader = [...latestRows].sort((left, right) => right.totalDownloads - left.totalDownloads)[0];

  platformHistorySummaryEl.textContent =
    `Aggregated platform totals across ${syncRuns} sync run${syncRuns === 1 ? "" : "s"}. ` +
    `Latest leader: ${leader.platform} with ${formatNumber(leader.totalDownloads)} downloads.`;
}

function summarizePointDeltaHistory(deltaItems) {
  if (!deltaHistorySummaryEl) {
    return;
  }

  if (!deltaItems.length) {
    deltaHistorySummaryEl.textContent = "No matching delta history for the selected filters yet.";
    return;
  }

  const nonInitialPoints = deltaItems.filter((item) => item.totalDownloads !== 0);

  if (!nonInitialPoints.length) {
    deltaHistorySummaryEl.textContent = "Need at least two sync points to calculate per-point deltas.";
    return;
  }

  const latestSync = deltaItems[deltaItems.length - 1].syncedAt;
  const latestRows = deltaItems.filter((item) => item.syncedAt === latestSync);
  const latestLeader = [...latestRows].sort((left, right) => right.totalDownloads - left.totalDownloads)[0];
  const biggestChange = [...nonInitialPoints].sort(
    (left, right) => Math.abs(right.totalDownloads) - Math.abs(left.totalDownloads)
  )[0];

  deltaHistorySummaryEl.textContent =
    `Latest delta at ${formatDate(latestSync)}: ${latestLeader.releaseTag} ${latestLeader.platform} ` +
    `${formatSignedNumber(latestLeader.totalDownloads)}. ` +
    `Largest absolute change in this view: ${biggestChange.releaseTag} ${biggestChange.platform} ` +
    `${formatSignedNumber(biggestChange.totalDownloads)}.`;
}

function renderLegend(container, keys, formatter) {
  if (!container) {
    return;
  }

  container.innerHTML = keys
    .map(
      (key) => `
        <span class="legend-item">
          <span class="legend-swatch" style="background:${platformColors[key.platform] ?? "#6c5a45"}"></span>
          ${formatter(key)}
        </span>
      `
    )
    .join("");
}

function renderLineChart({ svgEl, legendEl, items, seriesKey, legendFormatter, valueMode = "absolute" }) {
  if (!svgEl || !legendEl) {
    return;
  }

  if (!items.length) {
    svgEl.innerHTML = "";
    legendEl.innerHTML = "";
    return;
  }

  const pointsBySeries = new Map();

  for (const item of items) {
    const key = seriesKey(item);
    const series = pointsBySeries.get(key) ?? {
      ...item,
      points: []
    };

    series.points.push(item);
    pointsBySeries.set(key, series);
  }

  const seriesList = Array.from(pointsBySeries.values()).sort((left, right) => {
    if (left.platform === right.platform) {
      return (right.releaseTag ?? "").localeCompare(left.releaseTag ?? "");
    }

    return left.platform.localeCompare(right.platform);
  });

  const preparedSeries = seriesList.map((series) => {
    const sortedPoints = [...series.points].sort((left, right) => left.syncedAt.localeCompare(right.syncedAt));
    const baseline = sortedPoints[0]?.totalDownloads ?? 0;

    return {
      ...series,
      points: sortedPoints.map((point) => ({
        ...point,
        chartDownloads:
          valueMode === "delta-from-first" ? point.totalDownloads - baseline : point.totalDownloads
      }))
    };
  });

  const allPoints = preparedSeries.flatMap((series) => series.points);
  const syncLabels = [...new Set(allPoints.map((item) => item.syncedAt))];
  const syncIndexByLabel = new Map(syncLabels.map((label, index) => [label, index]));
  const pointValues = allPoints.map((item) => item.chartDownloads);
  const rawMinDownloads = Math.min(...pointValues);
  const rawMaxDownloads = Math.max(...pointValues);
  const rawRange = rawMaxDownloads - rawMinDownloads;
  const yPadding = rawRange === 0 ? Math.max(rawMaxDownloads * 0.02, 1) : Math.max(rawRange * 0.08, 1);
  const yMin = rawMinDownloads - yPadding;
  const yMax = rawMaxDownloads + yPadding;
  const yRange = Math.max(yMax - yMin, 1);

  const width = 880;
  const height = 320;
  const padding = { top: 20, right: 20, bottom: 42, left: 64 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, index) => {
    return yMax - (yRange / gridLines) * index;
  });

  const xStep = syncLabels.length > 1 ? plotWidth / (syncLabels.length - 1) : 0;

  const gridMarkup = yTicks
    .map((tick, index) => {
      const y = padding.top + (plotHeight / gridLines) * index;
      return `
        <line class="chart-grid" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line>
        <text class="chart-label" x="${padding.left - 12}" y="${y + 4}" text-anchor="end">${formatNumber(Math.round(tick))}</text>
      `;
    })
    .join("");

  const xAxisLabels = syncLabels
    .map((label, index) => {
      const x = padding.left + xStep * index;
      const text = new Intl.DateTimeFormat("en-CH", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(label));

      return `<text class="chart-label" x="${x}" y="${height - 12}" text-anchor="middle">${text}</text>`;
    })
    .join("");

  const seriesMarkup = preparedSeries
    .map((series) => {
      const path = series.points
        .map((point, index) => {
          const x = padding.left + xStep * syncIndexByLabel.get(point.syncedAt);
          const y = padding.top + plotHeight - ((point.chartDownloads - yMin) / yRange) * plotHeight;

          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

      const dots = series.points
        .map((point) => {
          const x = padding.left + xStep * syncIndexByLabel.get(point.syncedAt);
          const y = padding.top + plotHeight - ((point.chartDownloads - yMin) / yRange) * plotHeight;

          return `<circle class="chart-dot" cx="${x}" cy="${y}" r="4.5" fill="${platformColors[series.platform] ?? "#6c5a45"}"></circle>`;
        })
        .join("");

      return `
        <path class="chart-line" d="${path}" stroke="${platformColors[series.platform] ?? "#6c5a45"}"></path>
        ${dots}
      `;
    })
    .join("");

  svgEl.innerHTML = `
    <line class="chart-axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}"></line>
    <line class="chart-axis" x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}"></line>
    ${gridMarkup}
    ${seriesMarkup}
    ${xAxisLabels}
  `;

  renderLegend(legendEl, preparedSeries, legendFormatter);
}

function renderPlatformHistoryChart(data) {
  if (!platformHistoryChartEl || !platformHistoryLegendEl || !platformHistorySummaryEl) {
    return;
  }

  const selectedPlatform = platformFilterEl.value;
  const items = selectedPlatform
    ? data.platformTrend.filter((item) => item.platform === selectedPlatform)
    : data.platformTrend;

  summarizePlatformTrend(items);
  renderLineChart({
    svgEl: platformHistoryChartEl,
    legendEl: platformHistoryLegendEl,
    items,
    seriesKey: (item) => item.platform,
    legendFormatter: (item) => item.platform
  });
}

function renderHistoryChart(data) {
  const items = getFilteredHistory(data);
  summarizeHistory(items);
  renderLineChart({
    svgEl: historyChartEl,
    legendEl: chartLegendEl,
    items,
    seriesKey: (item) => `${item.releaseTag}:${item.platform}`,
    legendFormatter: (item) => `${item.releaseTag} - ${item.platform}`
  });
}

function renderPointDeltaHistoryChart(data) {
  if (!deltaHistoryChartEl || !deltaHistoryLegendEl || !deltaHistorySummaryEl) {
    return;
  }

  const seriesKey = (item) => `${item.releaseTag}:${item.platform}`;
  const items = getFilteredHistory(data);
  const deltaItems = buildPointDeltaHistory(items, seriesKey);
  summarizePointDeltaHistory(deltaItems);
  renderLineChart({
    svgEl: deltaHistoryChartEl,
    legendEl: deltaHistoryLegendEl,
    items: deltaItems,
    seriesKey,
    legendFormatter: (item) => `${item.releaseTag} - ${item.platform}`
  });
}

function renderDashboard(data) {
  repoNameEl.textContent = data.meta.repo;
  latestSyncEl.textContent = data.syncRuns.length
    ? formatDate(data.syncRuns[data.syncRuns.length - 1].syncedAt)
    : "No sync yet";

  populateFilters(data);
  renderPlatformCards(data);
  renderBarList(data);
  renderCurrentTable(data);
  renderHistoryChart(data);
  renderPlatformHistoryChart(data);
  renderPointDeltaHistoryChart(data);
}

async function loadDashboard() {
  try {
    const response = await fetch("./data/downloads.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Dashboard data request failed with ${response.status}`);
    }

    const rawStore = await response.json();
    dashboardData = {
      meta: rawStore.meta,
      syncRuns: rawStore.syncRuns,
      current: buildCurrentFromStore(rawStore.assetSnapshots),
      platformTotals: buildPlatformTotalsFromStore(rawStore.assetSnapshots),
      platformTrend: buildPlatformTrendFromStore(rawStore.assetSnapshots),
      history: buildHistoryFromStore(rawStore.assetSnapshots)
    };

    renderDashboard(dashboardData);
  } catch (error) {
    console.error("Dashboard render failed:", error);
    platformGridEl.innerHTML = createStatus(`Could not load dashboard data. ${error.message}`);
    barListEl.innerHTML = "";
    currentTableEl.innerHTML = "";

    if (platformHistoryChartEl) {
      platformHistoryChartEl.innerHTML = "";
    }

    if (platformHistoryLegendEl) {
      platformHistoryLegendEl.innerHTML = "";
    }

    if (platformHistorySummaryEl) {
      platformHistorySummaryEl.textContent = "Sync the dataset first, then refresh this page.";
    }

    if (historyChartEl) {
      historyChartEl.innerHTML = "";
    }

    if (chartLegendEl) {
      chartLegendEl.innerHTML = "";
    }

    if (historySummaryEl) {
      historySummaryEl.textContent = "Sync the dataset first, then refresh this page.";
    }

    if (deltaHistoryChartEl) {
      deltaHistoryChartEl.innerHTML = "";
    }

    if (deltaHistoryLegendEl) {
      deltaHistoryLegendEl.innerHTML = "";
    }

    if (deltaHistorySummaryEl) {
      deltaHistorySummaryEl.textContent = "Sync the dataset first, then refresh this page.";
    }

    repoNameEl.textContent = "Unavailable";
    latestSyncEl.textContent = "Unavailable";
  }
}

filtersFormEl.addEventListener("change", () => {
  if (dashboardData) {
    renderHistoryChart(dashboardData);
    renderPlatformHistoryChart(dashboardData);
    renderPointDeltaHistoryChart(dashboardData);
  }
});

loadDashboard();
