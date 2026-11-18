import { Router } from "express";
import {
  adjustInventory,
  getAlerts,
  getHistory,
  getSummary,
  listInventory,
} from "../controllers/inventory.controller.js";
import {
  validateAlertQuery,
  validateInventoryAdjustment,
  validateInventoryHistoryQuery,
  validateInventoryListQuery,
} from "../validators/inventory.validator.js";
import { validateProductId } from "../validators/product.validator.js";

const router = Router();

router.get("/", validateInventoryListQuery, listInventory);
router.get("/summary", getSummary);
router.get("/alerts", validateAlertQuery, getAlerts);
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
