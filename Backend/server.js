import app from "./src/app.js";
import { port, nodeEnv } from "./src/config/env.js";
import { pool, testDatabaseConnection } from "./src/config/db.js";

let server;

async function startServer() {
  try {
    await testDatabaseConnection();
    server = app.listen(port, () => {
      console.log(`BizPilot API listening on http://localhost:${port} (${nodeEnv})`);
    });
  } catch (error) {
    console.error("Unable to start BizPilot API:", error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);
  if (server) {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  } else {
    await pool.end();
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
