import { Router } from "express";

import { askInsights } from "../controllers/insights.controller.js";
import { validateInsightsRequest } from "../validators/insights.validator.js";

const router = Router();

router.post(
  "/ask",
  validateInsightsRequest,
  askInsights
);

export default router;