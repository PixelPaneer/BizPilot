import { Router } from "express";
import {
  categorySales,
  salesTrend,
  topProducts,
  revenueAnalysis,
} from "../controllers/analytics.controller.js";
import { requireBusinessContext } from "../middleware/requireBusinessContext.js";
import { validateAnalyticsQuery } from "../validators/analytics.validator.js";

const router = Router();

router.use(requireBusinessContext);
router.get("/category-sales", validateAnalyticsQuery, categorySales);
router.get("/sales-trend", validateAnalyticsQuery, salesTrend);
router.get("/top-products", validateAnalyticsQuery, topProducts);
router.get("/revenue-analysis", validateAnalyticsQuery, revenueAnalysis);

export default router;