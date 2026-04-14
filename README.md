# BitBoxApp Download Tracker Service

This service collects GitHub release download counts for BitBoxApp and stores them as time-series snapshots so you can build a dashboard later.

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

Linux download counts are stored at distribution level and aggregated to `linux` in the API.

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
- `AUTO_SYNC_ON_STARTUP`: set to `true` to fetch immediately when the server boots

## Running

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

## Scheduled Syncing

The repo now includes a GitHub Actions workflow at [.github/workflows/sync-downloads.yml](/abs/path/d:/Users/Jad/github_new_pc/gh-download-tracker-service/.github/workflows/sync-downloads.yml) that:

- runs hourly
- can also be triggered manually with `workflow_dispatch`
- executes `npm run sync`
- commits the updated [data/downloads.json](/abs/path/d:/Users/Jad/github_new_pc/gh-download-tracker-service/data/downloads.json) back into the repository when values change

This gives you a simple time-series store without needing a separate database on day one.

If you want better long-term scalability later, the clean upgrade path is:

- keep the sync logic
- replace JSON file storage with SQLite or Postgres
- point the dashboard at the database-backed API

## Suggested Next Step

Once this collector is running on a schedule, the next natural step is a tiny dashboard app that charts:

- downloads per platform per release
- growth of a release over time
- total current downloads by platform
