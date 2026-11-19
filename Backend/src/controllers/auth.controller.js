import * as userModel from "../models/user.model.js";
import * as authService from "../services/auth.service.js";
import { comparePassword } from "../utils/password.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// The refresh token lives only in this cookie: httpOnly (scripts cannot read it), and sent only to
// the auth endpoints.
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

  // Registration does not issue a token. The user signs in after account creation.
  return res.status(201).json(
    new ApiResponse(201, { user, business }, "Account created. Please sign in.")
  );
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await userModel.findUserByEmail(email.trim().toLowerCase());

  // Keep the response generic to avoid revealing whether an email exists.
  if (!user || !(await comparePassword(password, user.password_hash))) {
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

// Exchanges the refresh cookie for a new access token (and a new refresh cookie).
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

export { register, login, refresh, logout, getCurrentUser };
