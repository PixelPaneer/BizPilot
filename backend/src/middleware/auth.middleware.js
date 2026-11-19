import jwt from "jsonwebtoken";
import { jwtSecret } from "../config/env.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import * as userModel from "../models/user.model.js";

// This file protects private API endpoints.

const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Authentication required. Please sign in.");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch (error) {
    throw new ApiError(401, "Your session is invalid or expired. Please sign in again.");
  }

  const user = await userModel.findPublicUserById(decoded.sub);
  if (!user || !user.is_active) {
    throw new ApiError(401, "Your account is unavailable. Please sign in again.");
  }

  req.user = user;
  next();
});

export { authenticate };
