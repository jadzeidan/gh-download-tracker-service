import path from "node:path";

const rootDir = process.cwd();

export const config = {
  port: Number(process.env.PORT ?? 3000),
  githubToken: process.env.GITHUB_TOKEN ?? "",
  githubRepoOwner: process.env.GITHUB_REPO_OWNER ?? "BitBoxSwiss",
  githubRepoName: process.env.GITHUB_REPO_NAME ?? "bitbox-wallet-app",
  dataFilePath: process.env.DATA_FILE_PATH
    ? path.resolve(process.env.DATA_FILE_PATH)
    : path.join(rootDir, "data", "downloads.json"),
  pagesDataFilePath: process.env.PAGES_DATA_FILE_PATH
    ? path.resolve(process.env.PAGES_DATA_FILE_PATH)
    : path.join(rootDir, "docs", "data", "downloads.json"),
  autoSyncOnStartup: process.env.AUTO_SYNC_ON_STARTUP === "true"
};

export function getRepoSlug() {
  return `${config.githubRepoOwner}/${config.githubRepoName}`;
}
