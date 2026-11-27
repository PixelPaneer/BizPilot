import { searchFaqs } from "../services/internalFaq.service.js";
import { validateFaqSearch } from "../validators/internalFaq.validator.js";
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { searchCatalog } from "../services/catalog.service.js";
import { validateCatalogSearch } from "../validators/catalog.validator.js";
import * as analyticsService from "../services/analytics.service.js";
import { validateAnalyticsQuery } from "../validators/analytics.validator.js";

// Routes only the AI service may call. app.js mounts them behind serviceAuth, so req.serviceBusinessId
// is always set here. They are not versioned and not reachable with an owner's sign-in.
const router = Router();

// Foundation check, AI -> Node: the token was accepted, and this is the shop it names.
router.get("/ping", (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: "ok", businessId: req.serviceBusinessId },
  });
});

// Customer-safe product search (AI -> Node). The shop is the one in the service token. The answer
// holds only what a customer may be told: name, category, unit, price and a stock status.
router.get(
  "/catalog/search",
  validateCatalogSearch,
  asyncHandler(async (req, res) => {
    const data = await searchCatalog(req.serviceBusinessId, {
      q: req.query.q,
      limit: req.query.limit,
    });
    res.status(200).json({ success: true, data });
  })
);


// Customer-safe FAQ search (AI -> Node).
// Business identity comes exclusively from the verified service JWT.
router.get(
  "/faqs/search",
  validateFaqSearch,
  asyncHandler(async (req, res) => {
    const data = await searchFaqs(req.serviceBusinessId, {
      q: req.query.q,
      language: req.query.language,
      limit: req.query.limit,
    });

    res.status(200).json({
      success: true,
      data,
    });
  })
);

// Owner analytics data for the Insights Agent. Business identity comes from the service JWT.
router.get(
  "/analytics/category-sales",
  validateAnalyticsQuery,
  asyncHandler(async (req, res) => {
    const data = await analyticsService.getCategorySales(
      req.serviceBusinessId,
      req.query
    );
    res.status(200).json({ success: true, data });
  })
);

router.get(
  "/analytics/top-products",
  validateAnalyticsQuery,
  asyncHandler(async (req, res) => {
    const data = await analyticsService.getTopProducts(
      req.serviceBusinessId,
      req.query
    );
    res.status(200).json({ success: true, data });
  })
);

router.get(
  "/analytics/revenue-analysis",
  validateAnalyticsQuery,
  asyncHandler(async (req, res) => {
    const data = await analyticsService.getRevenueAnalysis(
      req.serviceBusinessId,
      req.query
    );
    res.status(200).json({ success: true, data });
  })
);

router.get(
  "/analytics/slow-movers",
  validateAnalyticsQuery,
  asyncHandler(async (req, res) => {
    const data = await analyticsService.getSlowMovers(
      req.serviceBusinessId,
      req.query
    );
    res.status(200).json({ success: true, data });
  })
);

export default router;
