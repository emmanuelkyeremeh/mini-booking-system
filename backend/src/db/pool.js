import pg from "pg";
import { getEnv } from "../config/env.js";

const { Pool } = pg;

let pool;

export function getDbPool() {
  if (pool) return pool;

  const env = getEnv();
  pool = new Pool({
    connectionString: env.DATABASE_URL,
  });
  return pool;
}

