import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

export async function publishPagesData() {
  await fs.mkdir(path.dirname(config.pagesDataFilePath), { recursive: true });
  await fs.copyFile(config.dataFilePath, config.pagesDataFilePath);
}
