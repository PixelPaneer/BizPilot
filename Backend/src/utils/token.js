import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

function generateAccessToken(user) {
  if (!env.jwtSecret) {
    throw new ApiError(
      503,
      "Sign-in is not configured on this server (JWT_SECRET is missing).",
      [],
      "AUTH_NOT_CONFIGURED"
    );
  }

  return jwt.sign(
    {
      sub: user.user_id,
      email: user.email
    },
    env.jwtSecret,
    { algorithm: "HS256", expiresIn: env.jwtExpiresIn }
  );
}

export { generateAccessToken };
