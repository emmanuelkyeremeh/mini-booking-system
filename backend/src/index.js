import { getEnv } from "./config/env.js";
import { getDbPool } from "./db/pool.js";
import { createApp } from "./app.js";

const env = getEnv();
// Ensure the DB can be reached on boot (fail fast in dev).
await getDbPool().query("SELECT 1");

const app = createApp();
app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${env.PORT}`);
});

