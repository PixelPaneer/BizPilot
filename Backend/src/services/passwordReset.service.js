import { nodeEnv } from "../config/env.js";
import { withTransaction } from "../config/db.js";
import * as userModel from "../models/user.model.js";
import * as resetModel from "../models/passwordReset.model.js";
import { hashPassword } from "../utils/password.js";
import ApiError from "../utils/ApiError.js";
import { canonicalWhatsapp, whatsappVariants } from "../utils/phone.js";
import {
  generateOtp,
  hashOtp,
  hashResetToken,
  newResetToken,
  safeEqualHex,
} from "../utils/otp.js";
import { isEmailConfigured, sendPasswordResetOtpEmail } from "./email.service.js";
import { isWhatsappConfigured, sendOtpWhatsApp } from "./whatsapp.service.js";

export const OTP_VALID_MINUTES = 10; // how long an OTP can be entered
export const RESEND_COOLDOWN_SECONDS = 60; // matches the timer on the page
export const MAX_OTP_ATTEMPTS = 5; // wrong guesses allowed per OTP
export const RESET_WINDOW_MINUTES = 10; // time to choose a new password after the OTP is accepted

// Every answer takes at least this long, so the time a reply takes cannot tell a real account from
// one that does not exist (sending the OTP is also done after the reply, not during it).
const MIN_REQUEST_MS = 300;
const MIN_VERIFY_MS = 150;

async function atLeast(ms, fn) {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    const remaining = ms - (Date.now() - started);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

const isChannelConfigured = (channel) => (channel === "email" ? isEmailConfigured() : isWhatsappConfigured());

const INVALID_OTP = () =>
  new ApiError(400, "Invalid or expired OTP. Please check the code or request a new one.", [], "INVALID_OTP");
const RESET_EXPIRED = () =>
  new ApiError(400, "Your reset session has expired. Please start again.", [], "RESET_SESSION_INVALID");

// The channel, the address the OTP goes to, and the account it belongs to (or null).
async function resolveTarget({ channel, email, whatsappNumber }) {
  if (channel === "email") {
    const destination = email.trim().toLowerCase();
    const user = await userModel.findUserByEmail(destination);
    return { channel, destination, user: user?.is_active ? user : null };
  }

  const destination = canonicalWhatsapp(whatsappNumber);
  const matches = (await userModel.findUsersByWhatsappNumber(whatsappVariants(destination))).filter((u) => u.is_active);
  // A number shared by several accounts cannot say whose password to reset, so none is.
  return { channel, destination, user: matches.length === 1 ? matches[0] : null };
}

// Sends the OTP. With a provider set up this happens after the reply has gone, and a failure is
// only logged (the stored code is then removed): the answer must not depend on whether an account
// exists, and a failed send would otherwise be visible only for real accounts.
function deliver({ channel, destination, user }, otpId, otp) {
  if (!isChannelConfigured(channel)) {
    // Development only (production is refused earlier): the code goes to the server log.
    console.log(`[DEV] Password reset OTP for ${destination} (${channel}): ${otp}`);
    return;
  }

  const sending =
    channel === "email"
      ? sendPasswordResetOtpEmail(destination, otp, { firstName: user.first_name, validMinutes: OTP_VALID_MINUTES })
      : sendOtpWhatsApp(destination, otp);

  sending.catch(async (error) => {
    console.error(`Password reset OTP was not delivered (${channel}):`, error.message);
    await resetModel.deleteOtp(otpId).catch(() => {});
  });
}

async function issueOtp(target) {
  const resolved = await resolveTarget(target);
  const { user, channel, destination } = resolved;
  if (!user) return;

  // Asking again inside the cooldown does nothing (the page's own timer is the same 60 seconds).
  const latest = await resetModel.findLatestForUser(user.user_id, channel);
  if (latest && Date.now() - new Date(latest.created_at).getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    return;
  }

  const otp = generateOtp();
  const created = await withTransaction(async (client) => {
    await resetModel.invalidateOpenForUser(client, user.user_id);
    return resetModel.createOtp(client, {
      userId: user.user_id,
      channel,
      destination,
      otpHash: hashOtp(user.user_id, otp),
      expiresAt: new Date(Date.now() + OTP_VALID_MINUTES * 60 * 1000),
    });
  });

  deliver(resolved, created.otp_id, otp);
  resetModel.deleteOld().catch((error) => console.error("OTP cleanup failed:", error));
}

// Step 1. The answer is the same whether or not an account exists for the address (same status,
// same body, similar time), so the form cannot be used to find out who has an account.
export async function requestPasswordResetOtp(target) {
  // A channel that is not set up is the same problem for every address, so it is checked first,
  // before any account is looked at.
  if (nodeEnv === "production" && !isChannelConfigured(target.channel)) {
    throw new ApiError(503, `Sending OTPs by ${target.channel} is not set up yet.`, [], "OTP_CHANNEL_NOT_CONFIGURED");
  }

  await atLeast(MIN_REQUEST_MS, () => issueOtp(target));
}

// Step 2. Checks the OTP and hands back a one-time token for step 3.
export function verifyPasswordResetOtp(target, otp) {
  return atLeast(MIN_VERIFY_MS, () => checkOtp(target, otp));
}

async function checkOtp(target, otp) {
  const { user, channel, destination } = await resolveTarget(target);
  if (!user) throw INVALID_OTP();

  const row = await resetModel.findEnterableOtp(user.user_id, channel, destination);
  if (!row) throw INVALID_OTP();

  const attempts = await resetModel.recordAttempt(row.otp_id);
  // Too many tries looks like any other wrong code: only a real account with an open OTP could
  // answer differently, which would give away that the account exists.
  if (attempts > MAX_OTP_ATTEMPTS) throw INVALID_OTP();
  if (!safeEqualHex(hashOtp(user.user_id, otp), row.otp_hash)) throw INVALID_OTP();

  const resetToken = newResetToken();
  if (!(await resetModel.markVerified(row.otp_id, hashResetToken(resetToken)))) throw INVALID_OTP();

  return { resetToken };
}

// Step 3. Sets the new password, ends every sign-in of that account, and uses up the OTP.
export async function resetPassword(resetToken, password) {
  const passwordHash = await hashPassword(password);

  await withTransaction(async (client) => {
    const row = await resetModel.findVerifiedByTokenForUpdate(
      client,
      hashResetToken(resetToken),
      RESET_WINDOW_MINUTES
    );
    if (!row) throw RESET_EXPIRED();

    const user = await userModel.findPublicUserById(row.user_id);
    if (!user?.is_active) throw RESET_EXPIRED();

    await userModel.updatePasswordHash(client, row.user_id, passwordHash);
    await resetModel.consumeAllForUser(client, row.user_id);
  });
}

