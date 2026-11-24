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

// Forgot password and sign-up number verification: how the 6-digit OTP is delivered. Email goes
// through SMTP, WhatsApp through the WhatsApp Cloud API (an approved "authentication" template).
// When a channel is not set up, outside production the OTP is printed in the server log instead;
// in production the OTP calls answer 503.
export const smtp = {
  host: process.env.SMTP_HOST?.trim() || null,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  user: process.env.SMTP_USER?.trim() || null,
  pass: process.env.SMTP_PASS || null,
  from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || null
};
export const whatsapp = {
  apiToken: process.env.WHATSAPP_API_TOKEN?.trim() || null,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null,
  otpTemplate: process.env.WHATSAPP_OTP_TEMPLATE?.trim() || "bizpilot_otp",
  templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en",
  apiVersion: process.env.WHATSAPP_API_VERSION?.trim() || "v20.0"
};
