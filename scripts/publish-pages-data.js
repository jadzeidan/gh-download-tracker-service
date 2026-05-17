import { initializeStore } from "../src/service.js";
import { publishPagesData } from "../src/pages-data.js";

async function main() {
  await initializeStore();
  await publishPagesData();
  console.log("Published dashboard data to docs/data/downloads.json");
}

main().catch((error) => {
  console.error(error.stack);
  process.exit(1);
});
