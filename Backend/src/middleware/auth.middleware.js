import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as userModel from "../models/user.model.js";

// Protects private API endpoints. Sets req.user (with user_id) for the routes after it.
//
// Development shortcut: outside production, when DEV_USER_ID is set, every request is treated as
// that user and no token is needed. Leave DEV_USER_ID empty to use real sign-in.
export const authenticate = asyncHandler(async (req, res, next) => {
  if (env.nodeEnv !== "production" && env.devUserId) {
    req.user = { user_id: env.devUserId };
    return next();
  }

  if (!env.jwtSecret) {
    throw new ApiError(
      503,
      "Sign-in is not configured on this server (JWT_SECRET is missing).",
      [],
      "AUTH_NOT_CONFIGURED"
    );
  }

  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Authentication required. Please sign in.", [], "UNAUTHENTICATED");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    throw new ApiError(
      401,
      "Your session is invalid or expired. Please sign in again.",
      [],
      "UNAUTHENTICATED"
    );
  }

  const user = await userModel.findPublicUserById(decoded.sub);
  if (!user || !user.is_active) {
    throw new ApiError(
      401,
      "Your account is unavailable. Please sign in again.",
      [],
      "UNAUTHENTICATED"
    );
  }

  req.user = user;
  next();
});
