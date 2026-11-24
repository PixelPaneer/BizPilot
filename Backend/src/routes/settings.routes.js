
import express from "express";

import controller from "../controllers/settings.controller.js";
import { validateSettings } from "../validators/settings.validator.js";

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.user_id || !req.user.business_id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  next();
};

router.use(requireAuth);

router.get("/", controller.getSettings);
router.patch("/", validateSettings, controller.updateSettings);

export default router;
