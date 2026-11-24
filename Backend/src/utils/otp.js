import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { jwtSecret } from "../config/env.js";

// A 6-digit numeric OTP, e.g. "042917" (leading zeros kept).
export function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Keyed hash, so a leaked table cannot be used to work the 6-digit codes out offline. It is also
// tied to the user, so a code is only ever valid for the account it was sent for.
export function hashOtp(userId, otp) {
  const key = jwtSecret || "development-only-otp-key";
  return createHmac("sha256", key).update(`${userId}:${otp}`).digest("hex");
}

export function safeEqualHex(a, b) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function newResetToken() {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
