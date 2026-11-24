//db.js is the central database connection module. Establishes the connection between your backend and PostgreSQL.

import { Pool } from "pg";
import { databaseUrl, dbSsl } from "./env.js";

const pool = new Pool({              
  connectionString: databaseUrl,                        // PostgreSQL database URL
  ssl: dbSsl ? { rejectUnauthorized: false } : false,  //Enables SSL when configured
  max: 10,                                              //Maximum 10 connections in the pool
  idleTimeoutMillis: 30000,                             //Closes idle connections after a period
  connectionTimeoutMillis: 5000                         //Maximum time to establish a connection
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

async function testDatabaseConnection() {
  const result = await pool.query("SELECT current_database() AS database, NOW() AS server_time");
  console.log(`PostgreSQL connected: ${result.rows[0].database}`);
}

// Runs fn(client) in one transaction: everything is kept, or (if fn throws) nothing is.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export { pool, testDatabaseConnection, withTransaction };