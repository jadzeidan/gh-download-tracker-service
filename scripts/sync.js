import { initializeStore, runSync } from "../src/service.js";

async function main() {
  await initializeStore();
  const result = await runSync();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.stack);
  process.exit(1);
});
