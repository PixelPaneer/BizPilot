import userModel from "../models/user.model.js";
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
  const user = await userModel.createUser({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    passwordHash,
    whatsappNumber: whatsappNumber.trim()
  });

  // Registration does not issue a token. The user signs in after account creation.
  // is_active defaults to TRUE in the supplied PostgreSQL schema.
  return res.status(201).json(
    new ApiResponse(201, { user }, "Account created. Please sign in.")
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

export { register, login, getCurrentUser };

const authController = { register, login, getCurrentUser };
export default authController;
