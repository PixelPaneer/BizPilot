import app from "./src/app.js";
import { env } from "./src/config/env.js";
import { pool, checkDatabaseConnection } from "./src/config/db.js";

let server;
let isShuttingDown = false;

try {
  await checkDatabaseConnection();
  console.log("PostgreSQL connection established.");
  server = app.listen(env.port, () => {
    console.log(`BizPilot API listening on port ${env.port}`);
  });
} catch (error) {
  console.error("Unable to start server:", error.message);
  await pool.end();
  process.exit(1);
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received. Shutting down...`);

  if (server) {
    server.close(async () => {
      try {
        await pool.end();
        console.log("Database pool closed.");
        process.exit(0);
      } catch (error) {
        console.error("Shutdown error:", error);
        process.exit(1);
      }
    });
  } else {
    await pool.end();
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
