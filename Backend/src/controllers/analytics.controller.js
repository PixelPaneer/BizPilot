import { asyncHandler } from "../utils/asyncHandler.js";
import * as analyticsService from "../services/analytics.service.js";

export const categorySales = asyncHandler(async (req, res) => {
  const data = await analyticsService.getCategorySales(req.businessId, req.query);
  res.status(200).json({ success: true, data });
});

export const salesTrend = asyncHandler(async (req, res) => {
  const data = await analyticsService.getSalesTrend(req.businessId, req.query);
  res.status(200).json({ success: true, data });
});

export const topProducts = asyncHandler(async (req, res) => {
  const data = await analyticsService.getTopProducts(req.businessId, req.query);
  res.status(200).json({ success: true, data });
});

export const revenueAnalysis = asyncHandler(async (req, res) => {
  const data = await analyticsService.getRevenueAnalysis(req.businessId, req.query);
  res.status(200).json({ success: true, data });
});