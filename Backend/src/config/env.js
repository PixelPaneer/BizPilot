// Reads environment variables from .env using dotenv.

import dotenv from "dotenv";

dotenv.config();

const required = ["DATABASE_URL", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long.");
}

export const port = Number(process.env.PORT || 5000);
export const nodeEnv = process.env.NODE_ENV || "development";
export const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
export const databaseUrl = process.env.DATABASE_URL;
export const dbSsl = process.env.DB_SSL === "true";
export const jwtSecret = process.env.JWT_SECRET;
export const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1d";
