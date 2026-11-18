import * as dashboardService from "../services/dashboard.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getSummary = asyncHandler(async (req, res) => {
  const data = await dashboardService.getSummary(
    req.businessId,
    req.query.period || "this_month"
  );
  res.status(200).json({ success: true, data });
});

export const getActivity = asyncHandler(async (req, res) => {
  const data = await dashboardService.getActivity(
    req.businessId,
    Number(req.query.limit || 5)
  );
  res.status(200).json({ success: true, data });
});

export const getProfile = asyncHandler(async (req, res) => {
  const data = await dashboardService.getOwnerProfile(
    req.user.user_id,
    req.businessId
  );
  res.status(200).json({ success: true, data });
});
