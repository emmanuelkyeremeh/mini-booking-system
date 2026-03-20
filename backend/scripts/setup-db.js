import { runMigrations } from "../src/db/migrate.js";
import { getEnv } from "../src/config/env.js";

async function main() {
  // Validate env early for clearer failures.
  getEnv();
  await runMigrations();
  // eslint-disable-next-line no-console
  console.log("Database setup complete.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

