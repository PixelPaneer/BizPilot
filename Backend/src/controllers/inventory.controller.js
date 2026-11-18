import * as inventoryService from "../services/inventory.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listInventory = asyncHandler(async (req, res) => {
  const data = await inventoryService.getInventory(req.businessId, req.query);
  res.status(200).json({ success: true, data });
});

export const getSummary = asyncHandler(async (req, res) => {
  const data = await inventoryService.getSummary(req.businessId);
  res.status(200).json({ success: true, data });
});

export const getAlerts = asyncHandler(async (req, res) => {
  const data = await inventoryService.getAlerts(
    req.businessId,
    req.query.status || "ACTIVE"
  );
  res.status(200).json({ success: true, data });
});

export const adjustInventory = asyncHandler(async (req, res) => {
  const data = await inventoryService.adjustInventory(
    req.businessId,
    req.user.user_id,
    req.params.id,
    req.body
  );
  res.status(200).json({ success: true, data });
});

export const getHistory = asyncHandler(async (req, res) => {
  const data = await inventoryService.getHistory(
    req.businessId,
    req.params.id,
    req.query
  );
  res.status(200).json({ success: true, data });
});
