import express from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
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
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later."
  }
});

router.post("/register", authLimiter, registerValidator, validateRequest, authController.register);
router.post("/login", authLimiter, loginValidator, validateRequest, authController.login);
// WhatsApp number verification on the sign-up page (before the account exists).
router.post("/whatsapp/send-otp", authLimiter, sendWhatsappOtpValidator, validateRequest, authController.sendWhatsappOtp);
router.post("/whatsapp/verify-otp", authLimiter, verifyWhatsappOtpValidator, validateRequest, authController.verifyWhatsappOtp);

// Forgot password: send an OTP (email or WhatsApp), check it, then set the new password.
router.post("/forgot-password", authLimiter, forgotPasswordValidator, validateRequest, authController.forgotPassword);
router.post(
  "/forgot-password/verify-otp",
  authLimiter,
  verifyResetOtpValidator,
  validateRequest,
  authController.verifyForgotPasswordOtp
);
router.post("/reset-password", authLimiter, resetPasswordValidator, validateRequest, authController.resetPassword);

router.get("/me", authenticate, authController.getCurrentUser);

export default router;
