import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { searchCatalog } from "../services/catalog.service.js";
import { validateCatalogSearch } from "../validators/catalog.validator.js";

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

export default router;
