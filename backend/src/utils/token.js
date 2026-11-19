import jwt from "jsonwebtoken";
import { jwtSecret, jwtExpiresIn } from "../config/env.js";

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.user_id,
      email: user.email
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

export { generateAccessToken };
