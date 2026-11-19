import express from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { registerValidator, loginValidator } from "../validators/auth.validator.js";

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
router.get("/me", authenticate, authController.getCurrentUser);

export default router;
