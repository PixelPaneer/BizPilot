
import dotenv from "dotenv";

dotenv.config();

// Authentication is temporarily disabled.
// Only DATABASE_URL is required for now.
const required = ["DATABASE_URL"];

for (const key of required) {
  if (!process.env[key]?.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const port = Number(process.env.PORT || 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be between 1 and 65535.");
}

export const env = {
  port,
  nodeEnv: process.env.NODE_ENV || "development",
  frontendOrigin:
    process.env.FRONTEND_ORIGIN ||
    process.env.CLIENT_ORIGIN ||
    "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  pgSsl:
    process.env.PGSSL === "true" ||
    process.env.DB_SSL === "true",

  // Authentication will be configured later.
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
};
