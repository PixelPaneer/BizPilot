import * as userModel from "../models/user.model.js";
import * as passwordResetService from "../services/passwordReset.service.js";
import * as whatsappSignupService from "../services/whatsappSignup.service.js";
import { withTransaction } from "../config/db.js";
import { canonicalWhatsapp, whatsappVariants } from "../utils/phone.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { generateAccessToken } from "../utils/token.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, whatsappNumber, password } = req.body;

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await userModel.findUserByEmail(normalizedEmail);

  if (existingUser) {
    throw new ApiError(409, "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(password);
  // Stored in one form, +<country code><number>, the same form the OTP verification uses and
  // the one sign-in and password reset look accounts up by.
  const whatsapp = canonicalWhatsapp(whatsappNumber.trim());

  let user;
  try {
    user = await withTransaction(async (client) => {
      // If this number was verified by OTP on the sign-up page a short while ago (the page
      // enforces it; it is not required here), the account is marked WhatsApp-verified.
      const whatsappVerified = await whatsappSignupService.takeVerification(client, whatsapp);
      return userModel.createUser(
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: normalizedEmail,
          passwordHash,
          whatsappNumber: whatsapp,
          whatsappVerified
        },
        client
      );
    });
  } catch (error) {
    // Two sign-ups with the same email at the same moment: the unique index decides.
    if (error.code === "23505") throw new ApiError(409, "An account with this email already exists.");
    throw error;
  }

  // Registration does not issue a token. The user signs in after account creation.
  // is_active defaults to TRUE in the supplied PostgreSQL schema.
  return res.status(201).json(
    new ApiResponse(201, { user }, "Account created. Please sign in.")
  );
});

// Signing in with a WhatsApp number. The number is not unique in the schema, so the password
// decides which account is meant; if it fits none (or, oddly, more than one), the sign-in fails.
async function findUserByWhatsappAndPassword(whatsappNumber, password) {
  const candidates = await userModel.findLoginCandidatesByWhatsappNumber(whatsappVariants(whatsappNumber));
  const matches = [];
  for (const candidate of candidates) {
    if (await comparePassword(password, candidate.password_hash)) matches.push(candidate);
  }
  return matches.length === 1 ? matches[0] : null;
}

const login = asyncHandler(async (req, res) => {
  const { email, whatsappNumber, password } = req.body;
  const user = whatsappNumber
    ? await findUserByWhatsappAndPassword(whatsappNumber, password)
    : await userModel.findUserByEmail(email.trim().toLowerCase());

  // Keep the response generic to avoid revealing whether an email exists.
  if (!user || (!whatsappNumber && !(await comparePassword(password, user.password_hash)))) {
    throw new ApiError(401, "Invalid email or password.");
  }

  if (!user.is_active) {
    throw new ApiError(403, "This account is inactive. Contact support.");
  }

  const publicUser = await userModel.findPublicUserById(user.user_id);
  const accessToken = generateAccessToken(publicUser);

  return res.status(200).json(
    new ApiResponse(200, { user: publicUser, accessToken }, "Signed in successfully.")
  );
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await userModel.findPublicUserById(req.user.user_id);
  if (!user || !user.is_active) {
    throw new ApiError(401, "Your session is no longer valid. Please sign in again.");
  }

  return res.status(200).json(
    new ApiResponse(200, { user }, "Current user retrieved.")
  );
});

// Sign-up page: verify the WhatsApp number before the account is created.
const sendWhatsappOtp = asyncHandler(async (req, res) => {
  await whatsappSignupService.sendSignupOtp(req.body.whatsappNumber);

  return res.status(200).json(new ApiResponse(200, null, "OTP sent on WhatsApp."));
});

const verifyWhatsappOtp = asyncHandler(async (req, res) => {
  await whatsappSignupService.verifySignupOtp(req.body.whatsappNumber, req.body.otp.trim());

  return res.status(200).json(new ApiResponse(200, { verified: true }, "WhatsApp number verified."));
});

// The target the OTP goes to, as the three forgot-password calls send it.
const resetTarget = ({ channel, email, whatsappNumber }) => ({ channel, email, whatsappNumber });

// Same answer (status, body and roughly the time taken) whether or not an account exists, so this
// cannot be used to look people up.
const forgotPassword = asyncHandler(async (req, res) => {
  await passwordResetService.requestPasswordResetOtp(resetTarget(req.body));

  return res.status(200).json(
    new ApiResponse(200, null, "If an account matches, a 6-digit OTP has been sent.")
  );
});

const verifyForgotPasswordOtp = asyncHandler(async (req, res) => {
  const { resetToken } = await passwordResetService.verifyPasswordResetOtp(
    resetTarget(req.body),
    req.body.otp.trim()
  );

  return res.status(200).json(new ApiResponse(200, { resetToken }, "OTP verified."));
});

const resetPassword = asyncHandler(async (req, res) => {
  await passwordResetService.resetPassword(req.body.resetToken.trim(), req.body.password);

  return res.status(200).json(
    new ApiResponse(200, null, "Password updated. Please sign in with your new password.")
  );
});

export {
  register,
  login,
  getCurrentUser,
  sendWhatsappOtp,
  verifyWhatsappOtp,
  forgotPassword,
  verifyForgotPasswordOtp,
  resetPassword
};
