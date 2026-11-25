import dotenv from "dotenv";

dotenv.config();

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

export const nodeEnv = process.env.NODE_ENV || "development";
const devUserId = process.env.DEV_USER_ID?.trim() || null;

// JWT_SECRET signs the sign-in tokens. Production will not start without it; elsewhere it may be
// left out (for example while the DEV_USER_ID shortcut is used), and sign-in then answers 503.
export const jwtSecret = process.env.JWT_SECRET?.trim();

if (!jwtSecret && nodeEnv === "production") {
  throw new Error("Missing required environment variable: JWT_SECRET");
}

if (jwtSecret && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long.");
}

// SERVICE_JWT_SECRET is shared with the AI service: each side signs the tokens it sends and checks
// the ones it receives with it. It may be left out until the AI service is used; the /internal
// routes and calls to the AI service then answer 503.
const serviceJwtSecret = process.env.SERVICE_JWT_SECRET?.trim();

if (serviceJwtSecret && serviceJwtSecret.length < 32) {
  throw new Error("SERVICE_JWT_SECRET must be at least 32 characters long.");
}

export const env = {
  port,
  nodeEnv,
  // One or more allowed browser origins, separated by commas.
  frontendOrigin:
    process.env.FRONTEND_ORIGIN ||
    process.env.CLIENT_ORIGIN ||
    "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  pgSsl:
    process.env.PGSSL === "true" ||
    process.env.DB_SSL === "true",
  devUserId,
  jwtSecret,
  // The access token is short-lived; the refresh token (below) is what keeps the owner signed in.
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  // Register and login attempts allowed per address in 15 minutes.
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT) || 20,
  // How long a refresh token (and so a sign-in) lasts without the owner coming back.
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
  // A refresh token that was just used may be used again for this many seconds, so that two
  // browser tabs refreshing at the same moment do not sign each other out.
  refreshReuseGraceSeconds: Number(process.env.REFRESH_REUSE_GRACE_SECONDS ?? 10),
  serviceJwtSecret,
  // Where the Python AI service runs.
  aiServiceUrl: (process.env.AI_SERVICE_URL || "http://localhost:8000").replace(/\/+$/, ""),
  // A service token lives this many seconds (the contract says 60 at most).
  serviceTokenTtlSeconds: 60,
  // The refresh token travels in an httpOnly cookie. Use COOKIE_SAMESITE=none (needs https) only if
  // the website and the API are on different sites.
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : nodeEnv === "production",
  cookieSameSite: ["lax", "strict", "none"].includes(process.env.COOKIE_SAMESITE)
    ? process.env.COOKIE_SAMESITE
    : "lax",
};

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
