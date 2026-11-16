import dotenv from "dotenv";

dotenv.config();

const required = ["DATABASE_URL", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]?.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long.");
}

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be between 1 and 65535.");
}

export const env = {
  port,
  nodeEnv: process.env.NODE_ENV || "development",
  frontendOrigin: process.env.FRONTEND_ORIGIN || process.env.CLIENT_ORIGIN || "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  pgSsl: process.env.PGSSL === "true" || process.env.DB_SSL === "true",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
};

// Named exports retained for the authentication module.
export const portNumber = env.port;
export const portValue = env.port;
export const nodeEnv = env.nodeEnv;
export const clientOrigin = env.frontendOrigin;
export const databaseUrl = env.databaseUrl;
export const dbSsl = env.pgSsl;
export const jwtSecret = env.jwtSecret;
export const jwtExpiresIn = env.jwtExpiresIn;
