
import { Router } from "express";

import {
  categorySales,
  salesTrend,
  topProducts,
  profit,
} from "../controllers/analytics.controller.js";

import { requireBusinessContext } from "../middleware/requireBusinessContext.js";
import { validateAnalyticsQuery } from "../validators/analytics.validator.js";

const router = Router();

// All analytics endpoints require business authentication.
router.use(requireBusinessContext);

// Sales Reports & Insights APIs
router.get("/sales-trend", validateAnalyticsQuery, salesTrend);

router.get("/category-sales", validateAnalyticsQuery, categorySales);

router.get("/top-products", validateAnalyticsQuery, topProducts);

router.get("/profit", validateAnalyticsQuery, profit);

export default router;
