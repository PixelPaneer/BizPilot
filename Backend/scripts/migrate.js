import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/config/db.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(scriptDirectory, "../src/db");
const advisoryLockId = 2026111801;

function withoutTransactionStatements(sql) {
  return sql
    .replace(/^\s*BEGIN;\s*$/im, "")
    .replace(/^\s*COMMIT;\s*$/im, "");
}

async function migrate() {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock($1::bigint)", [advisoryLockId]);
    lockAcquired = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const filenames = (await readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith(".sql"))
      .sort();
    const appliedResult = await client.query(
      "SELECT filename FROM schema_migrations"
    );
    const applied = new Set(appliedResult.rows.map((row) => row.filename));

    for (const filename of filenames) {
      if (applied.has(filename)) {
        continue;
      }

      const sql = await readFile(
        path.join(migrationsDirectory, filename),
        "utf8"
      );

      await client.query("BEGIN");
      try {
        await client.query(withoutTransactionStatements(sql));
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [filename]
        );
        await client.query("COMMIT");
        console.log(`Applied ${filename}`);
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            `Migration ${filename} failed and rollback also failed`,
            { cause: error }
          );
        }
        throw error;
      }
    }
  } finally {
    try {
      if (lockAcquired) {
        await client.query("SELECT pg_advisory_unlock($1::bigint)", [
          advisoryLockId,
        ]);
      }
    } finally {
      client.release();
    }
  }
}

try {
  await migrate();
} catch (error) {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
