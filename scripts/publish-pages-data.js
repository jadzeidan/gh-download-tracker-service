import { initializeStore } from "../src/service.js";
import { publishPagesData } from "../src/pages-data.js";

async function main() {
  await initializeStore();
  await publishPagesData();
  console.log("Published dashboard data index and snapshot chunks to docs/data/");
}

main().catch((error) => {
  console.error(error.stack);
  process.exit(1);
});
