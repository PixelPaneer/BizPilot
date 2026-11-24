import express from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth.controller.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  registerValidator,
  loginValidator,
  sendWhatsappOtpValidator,
  verifyWhatsappOtpValidator,
  forgotPasswordValidator,
  verifyResetOtpValidator,
  resetPasswordValidator
} from "../validators/auth.validator.js";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.authRateLimit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later."
  }
});

// These two are driven by the cookie alone, so a page on another site must not be able to trigger
// them: when the browser says which site the request comes from, it has to be one of ours.
const allowedOrigins = env.frontendOrigin.split(",").map((origin) => origin.trim());

function requireAllowedOrigin(req, res, next) {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    return next(new ApiError(403, "This request is not allowed from this site.", [], "ORIGIN_NOT_ALLOWED"));
  }
  next();
}

// Refreshing happens about every 15 minutes per signed-in browser, so its limit is looser.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.authRateLimit * 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

router.post("/register", authLimiter, registerValidator, validate, authController.register);
router.post("/login", authLimiter, loginValidator, validate, authController.login);
router.post("/whatsapp/send-otp", authLimiter, sendWhatsappOtpValidator, validate, authController.sendWhatsappOtp);
router.post("/whatsapp/verify-otp", authLimiter, verifyWhatsappOtpValidator, validate, authController.verifyWhatsappOtp);
router.post("/forgot-password", authLimiter, forgotPasswordValidator, validate, authController.forgotPassword);
router.post("/forgot-password/verify-otp", authLimiter, verifyResetOtpValidator, validate, authController.verifyForgotPasswordOtp);
router.post("/reset-password", authLimiter, resetPasswordValidator, validate, authController.resetPassword);
router.post("/refresh", requireAllowedOrigin, refreshLimiter, authController.refresh);
router.post("/logout", requireAllowedOrigin, authController.logout);
router.get("/me", authenticate, authController.getCurrentUser);

export default router;
