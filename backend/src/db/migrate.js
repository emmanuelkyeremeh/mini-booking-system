import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDbPool } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function migrationVersionFromFilename(filename) {
  // Example: "001_init.sql" -> "001_init"
  return filename.replace(/\.sql$/i, "");
}

export async function runMigrations() {
  const pool = getDbPool();

  // Ensure migrations table exists even before we run the first file.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const appliedVersions = new Set(
    (await pool.query(`SELECT version FROM schema_migrations;`)).rows.map((r) => r.version),
  );

  const migrationsDir = path.join(__dirname, "migrations");
  const entries = await fs.readdir(migrationsDir);
  const sqlFiles = entries.filter((e) => e.endsWith(".sql")).sort();

  for (const sqlFile of sqlFiles) {
    const version = migrationVersionFromFilename(sqlFile);
    if (appliedVersions.has(version)) continue;

    const fullPath = path.join(migrationsDir, sqlFile);
    const sql = await fs.readFile(fullPath, "utf8");

    await pool.query("BEGIN;");
    try {
      await pool.query(sql);
      await pool.query(`INSERT INTO schema_migrations(version) VALUES($1);`, [version]);
      await pool.query("COMMIT;");
    } catch (err) {
      await pool.query("ROLLBACK;");
      throw err;
    }
  }
}

