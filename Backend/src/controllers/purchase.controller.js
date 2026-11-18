import * as purchaseService from "../services/purchase.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const recordPurchase = asyncHandler(async (req, res) => {
  const { created, result } = await purchaseService.recordPurchase(
    req.businessId,
    req.user.user_id,
    { ...req.body, source: req.body.source ?? "MANUAL" }
  );
  res.status(created ? 201 : 200).json({ success: true, data: result });
});
