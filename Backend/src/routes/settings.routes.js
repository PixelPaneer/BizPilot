import { Router } from "express";
import * as controller from "../controllers/settings.controller.js";
import { uploadLogo } from "../middleware/upload.middleware.js";
import {
  validateAccount,
  validateBusinessProfile,
  validatePasswordChange,
  validateSettings,
} from "../validators/settings.validator.js";

// Mounted at /api/v1/settings behind authenticate + requireBusinessContext.
const router = Router();

router.get("/", controller.getSettings);
router.patch("/", validateSettings, controller.updateSettings);

router.get("/profile", controller.getBusinessProfile);
router.put("/profile", validateBusinessProfile, controller.updateBusinessProfile);
router.post("/profile/logo", uploadLogo, controller.uploadBusinessLogo);

router.get("/account", controller.getAccount);
router.put("/account", validateAccount, controller.updateAccount);
router.put("/account/password", validatePasswordChange, controller.changePassword);

export default router;
