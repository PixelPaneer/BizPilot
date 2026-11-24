import * as saleService from "../services/sale.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const recordSale = asyncHandler(async (req, res) => {
  const { created, result } = await saleService.recordSale(
    req.businessId,
    req.user.user_id,
    { ...req.body, source: req.body.source ?? "MANUAL", allowOversell: req.body.allowOversell === true }
  );
  // 201 for a new sale; 200 with the original result when the idempotency key was already used.
  res.status(created ? 201 : 200).json({ success: true, data: result });
});

export const voidSale = asyncHandler(async (req, res) => {
  const data = await saleService.voidSale(
    req.businessId,
    req.user.user_id,
    req.params.id,
    req.body.reason
  );
  res.status(200).json({ success: true, data });
});
