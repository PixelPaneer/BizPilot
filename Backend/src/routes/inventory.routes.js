import { Router } from "express";
import {
  adjustInventory,
  getAlerts,
  getHistory,
  getReorderSuggestions,
  getSummary,
  listInventory,
} from "../controllers/inventory.controller.js";
import {
  validateAlertQuery,
  validateInventoryAdjustment,
  validateInventoryHistoryQuery,
  validateInventoryListQuery,
  validateReorderQuery,
} from "../validators/inventory.validator.js";
import { validateProductId } from "../validators/product.validator.js";

const router = Router();

router.get("/", validateInventoryListQuery, listInventory);
router.get("/summary", getSummary);
router.get("/alerts", validateAlertQuery, getAlerts);
router.get("/reorder-suggestions", validateReorderQuery, getReorderSuggestions);
router.patch(
  "/:id",
  validateProductId,
  validateInventoryAdjustment,
  adjustInventory
);
router.get(
  "/:id/history",
  validateProductId,
  validateInventoryHistoryQuery,
  getHistory
);

export default router;
