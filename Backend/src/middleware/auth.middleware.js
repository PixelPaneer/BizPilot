import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export function authenticate(req, res, next) {
  if (env.nodeEnv !== "production" && env.devUserId) {
    req.user = { user_id: env.devUserId };
    return next();
  }

  return next(
    new ApiError(
      401,
      "Authentication required. Please sign in.",
      [],
      "UNAUTHENTICATED"
    )
  );
}
