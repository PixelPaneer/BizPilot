import * as userModel from "../models/user.model.js";
import * as authService from "../services/auth.service.js";
import * as passwordResetService from "../services/passwordReset.service.js";
import * as whatsappSignupService from "../services/whatsappSignup.service.js";
import { comparePassword } from "../utils/password.js";
import { canonicalWhatsapp, whatsappVariants } from "../utils/phone.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const REFRESH_COOKIE = "bizpilot_refresh";
const COOKIE_PATH = "/api/v1/auth";

function setRefreshCookie(res, token, expiresAt) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: COOKIE_PATH,
    expires: expiresAt,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: COOKIE_PATH,
  });
}

const register = asyncHandler(async (req, res) => {
  const { user, business } = await authService.registerOwner(req.body);

  return res.status(201).json(
    new ApiResponse(201, { user, business }, "Account created. Please sign in.")
  );
});

async function findUserByWhatsappAndPassword(whatsappNumber, password) {
  const candidates = await userModel.findLoginCandidatesByWhatsappNumber(
    whatsappVariants(canonicalWhatsapp(whatsappNumber))
  );
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

  if (!user || (!whatsappNumber && !(await comparePassword(password, user.password_hash)))) {
    throw new ApiError(401, "Invalid email or password.");
  }

  if (!user.is_active) {
    throw new ApiError(403, "This account is inactive. Contact support.");
  }

  const publicUser = await userModel.findPublicUserById(user.user_id);
  const { accessToken, refreshToken, refreshExpiresAt } = await authService.startSession(publicUser);
  setRefreshCookie(res, refreshToken, refreshExpiresAt);

  return res.status(200).json(
    new ApiResponse(200, { user: publicUser, accessToken }, "Signed in successfully.")
  );
});

const refresh = asyncHandler(async (req, res) => {
  try {
    const session = await authService.refreshSession(req.cookies?.[REFRESH_COOKIE]);
    setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);

    return res.status(200).json(
      new ApiResponse(200, { user: session.user, accessToken: session.accessToken }, "Session refreshed.")
    );
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
});

const logout = asyncHandler(async (req, res) => {
  await authService.endSession(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  return res.status(200).json(new ApiResponse(200, null, "Signed out."));
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

const sendWhatsappOtp = asyncHandler(async (req, res) => {
  await whatsappSignupService.sendSignupOtp(req.body.whatsappNumber);
  return res.status(200).json(new ApiResponse(200, null, "OTP sent on WhatsApp."));
});

const verifyWhatsappOtp = asyncHandler(async (req, res) => {
  await whatsappSignupService.verifySignupOtp(req.body.whatsappNumber, req.body.otp.trim());
  return res.status(200).json(new ApiResponse(200, { verified: true }, "WhatsApp number verified."));
});

const resetTarget = ({ channel, email, whatsappNumber }) => ({ channel, email, whatsappNumber });

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
  refresh,
  logout,
  getCurrentUser,
  sendWhatsappOtp,
  verifyWhatsappOtp,
  forgotPassword,
  verifyForgotPasswordOtp,
  resetPassword
};
