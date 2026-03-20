/**
 * Removes services, availability windows, and bookings (demo / test data).
 * Users are kept so you can log in again and recreate services.
 *
 * Usage: node scripts/clear-demo-data.js
 * Requires DATABASE_URL in env (same as server).
 */
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM bookings;`);
    await client.query(`DELETE FROM availability_windows;`);
    await client.query(`DELETE FROM services;`);
    await client.query("COMMIT");
    console.log("Cleared bookings, availability_windows, and services.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
