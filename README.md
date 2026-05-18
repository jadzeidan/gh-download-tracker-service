# BitBoxApp Download Tracker Service

This project collects GitHub release download counts for BitBoxApp and stores them as time-series snapshots for both a local API and a GitHub Pages dashboard.

It tracks these user-facing platforms:

- Windows
- macOS
- Linux
- Android APK

Signature files such as `.asc` are excluded from totals.

## What It Stores

Each sync stores one snapshot row per matching release asset with:

- sync timestamp
- release tag and publish date
- platform
- distribution type such as `dmg`, `exe`, `deb`, `rpm`, `appimage`, or `apk`
- current GitHub `download_count`

Linux download counts are stored at distribution level and aggregated to `linux` in the API and dashboard.

## Dashboard

A static dashboard lives in [docs/index.html](/abs/path/d:/Users/Jad/github_new_pc/gh-download-tracker-service/docs/index.html).

It reads an index at [docs/data/downloads.json](/abs/path/d:/Users/Jad/github_new_pc/gh-download-tracker-service/docs/data/downloads.json), then loads monthly snapshot chunks from `docs/data/snapshots/YYYY-MM.json`, and shows:

- current totals by platform
- a platform leaderboard
- release-by-release totals
- history over sync runs

This is GitHub Pages-friendly because it is plain HTML, CSS, JavaScript, and JSON.

## API

### `GET /health`

Basic health check.

### `POST /api/sync`

Fetches all non-draft, non-prerelease GitHub releases and appends a new snapshot run to local storage.

### `GET /api/dashboard`

Returns:

- `current`: latest totals per release and platform
- `platformTotals`: latest totals aggregated by platform
- `history`: time-series totals suitable for charting
- `syncRuns`: sync audit history

Optional query parameters:

- `releaseTag`
- `platform`

Example:

```bash
curl -X POST http://localhost:3000/api/sync
curl http://localhost:3000/api/dashboard
curl "http://localhost:3000/api/dashboard?platform=windows"
```

## Configuration

Environment variables:

- `PORT`: server port, default `3000`
- `GITHUB_TOKEN`: optional GitHub token to avoid low anonymous rate limits
- `GITHUB_REPO_OWNER`: default `BitBoxSwiss`
- `GITHUB_REPO_NAME`: default `bitbox-wallet-app`
- `DATA_FILE_PATH`: optional custom JSON storage path
- `PAGES_DATA_FILE_PATH`: optional custom Pages JSON output path
- `AUTO_SYNC_ON_STARTUP`: set to `true` to fetch immediately when the server boots

## Running

Use `.env.example` as a reference for required environment variables.

```bash
npm start
```

For development:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Publish the Pages data file from the local store:

```bash
npm run publish:pages-data
```

## Scheduled Syncing

The repo now includes a GitHub Actions workflow at [.github/workflows/sync-downloads.yml](/abs/path/d:/Users/Jad/github_new_pc/gh-download-tracker-service/.github/workflows/sync-downloads.yml) that:

- runs every three hours
- historical note: data collected before the May 17, 2026 schedule change used hourly snapshots
- can also be triggered manually with `workflow_dispatch`
- executes `npm run sync`
- updates [data/downloads.json](/abs/path/d:/Users/Jad/github_new_pc/gh-download-tracker-service/data/downloads.json) plus chunk files in `data/snapshots/`
- publishes matching index + chunk files to `docs/data/`
- commits the updated snapshot files back into the repository when values change

This gives you a simple time-series store without needing a separate database on day one.
The monthly chunk layout keeps full historical data while avoiding GitHub's 100 MB single-file limit.

## GitHub Pages Setup

You can host the dashboard on GitHub Pages by serving the `docs/` directory from your default branch.

Once enabled, the dashboard will load `./data/downloads.json` and the monthly `./data/snapshots/*.json` files from the Pages site.

If you want better long-term scalability later, the clean upgrade path is:

- keep the sync logic
- replace JSON file storage with SQLite or Postgres
- point the dashboard at the database-backed API
