import { Router } from "express";
import * as controller from "../controllers/settings.controller.js";
import { validateSettings } from "../validators/settings.validator.js";

const router = Router();

router.get("/", controller.getSettings);
router.patch("/", validateSettings, controller.updateSettings);

export default router;
