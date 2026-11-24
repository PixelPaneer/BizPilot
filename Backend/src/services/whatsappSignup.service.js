import { nodeEnv } from "../config/env.js";
import { withTransaction } from "../config/db.js";
import * as signupModel from "../models/whatsappSignup.model.js";
import ApiError from "../utils/ApiError.js";
import { canonicalWhatsapp } from "../utils/phone.js";
import { generateOtp, hashOtp, safeEqualHex } from "../utils/otp.js";
import { isWhatsappConfigured, sendOtpWhatsApp } from "./whatsapp.service.js";

const OTP_VALID_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60; // matches the timer on the page
const MAX_OTP_ATTEMPTS = 5;
export const VERIFIED_WINDOW_MINUTES = 60; // time to finish signing up after the number is verified

const INVALID_OTP = () =>
  new ApiError(400, "Invalid or expired OTP. Please check the code or request a new one.", [], "INVALID_OTP");

// The OTP is tied to the number it was sent to.
const otpKey = (number) => `signup:${number}`;

// Sign-up page, "Verify": sends a 6-digit OTP to the WhatsApp number.
export async function sendSignupOtp(whatsappNumber) {
  const number = canonicalWhatsapp(whatsappNumber);

  const latest = await signupModel.findLatest(number);
  if (latest && Date.now() - new Date(latest.created_at).getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    throw new ApiError(429, "Please wait a minute before asking for another OTP.", [], "OTP_RESEND_TOO_SOON");
  }

  if (!isWhatsappConfigured() && nodeEnv === "production") {
    throw new ApiError(503, "Sending OTPs by WhatsApp is not set up yet.", [], "OTP_CHANNEL_NOT_CONFIGURED");
  }

  const otp = generateOtp();
  const created = await withTransaction((client) =>
    signupModel.replaceOtp(client, {
      number,
      otpHash: hashOtp(otpKey(number), otp),
      expiresAt: new Date(Date.now() + OTP_VALID_MINUTES * 60 * 1000),
    })
  );

  try {
    if (isWhatsappConfigured()) await sendOtpWhatsApp(number, otp);
    // Development only: no provider set up, so the code goes to the server log.
    else console.log(`[DEV] WhatsApp verification OTP for ${number}: ${otp}`);
  } catch (error) {
    await signupModel.deleteOtp(created.otp_id).catch(() => {});
    throw error;
  }

  signupModel.deleteOld().catch((error) => console.error("OTP cleanup failed:", error));
}

// Sign-up page, "Confirm": checks the OTP. The number then counts as verified for an hour.
export async function verifySignupOtp(whatsappNumber, otp) {
  const number = canonicalWhatsapp(whatsappNumber);

  const row = await signupModel.findEnterable(number);
  if (!row) throw INVALID_OTP();

  const attempts = await signupModel.recordAttempt(row.otp_id);
  if (attempts > MAX_OTP_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect attempts. Please request a new OTP.", [], "OTP_ATTEMPTS_EXCEEDED");
  }
  if (!safeEqualHex(hashOtp(otpKey(number), otp), row.otp_hash)) throw INVALID_OTP();
  if (!(await signupModel.markVerified(row.otp_id))) throw INVALID_OTP();
}

// Used by registration, inside its transaction: true if this number was verified recently (and
// uses that verification up).
export function takeVerification(client, whatsappNumber) {
  return signupModel.takeRecentVerification(
    client,
    canonicalWhatsapp(whatsappNumber),
    VERIFIED_WINDOW_MINUTES
  );
}
