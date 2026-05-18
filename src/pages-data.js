import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

export async function publishPagesData() {
  const sourceDirectory = path.dirname(config.dataFilePath);
  const destinationDirectory = path.dirname(config.pagesDataFilePath);
  const sameDirectory = path.resolve(sourceDirectory) === path.resolve(destinationDirectory);

  if (sameDirectory) {
    return;
  }

  await fs.rm(destinationDirectory, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destinationDirectory), { recursive: true });
  await fs.cp(sourceDirectory, destinationDirectory, { recursive: true });
}
