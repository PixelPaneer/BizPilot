import { getInventorySummary } from "../models/inventory.model.js";
import {
  getProfile,
  getRevenueComparison,
  listRecentActivity,
} from "../models/dashboard.model.js";
import { ApiError } from "../utils/ApiError.js";

// The dashboard cards: current stock counts (not tied to the period) and revenue for the
// period compared with the matching stretch of the previous period.
export async function getSummary(businessId, period) {
  const [inventory, revenue] = await Promise.all([
    getInventorySummary(businessId),
    getRevenueComparison(businessId, period),
  ]);

  // With no sales in the previous period a percentage would be meaningless, so it is null.
  const revenueChangePercent =
    revenue.previous > 0
      ? Math.round(((revenue.current - revenue.previous) / revenue.previous) * 100)
      : null;

  return {
    totalProducts: inventory.total,
    inStockProducts: inventory.inStock,
    lowStockProducts: inventory.lowStock,
    outOfStockProducts: inventory.outOfStock,
    totalRevenue: revenue.current,
    previousRevenue: revenue.previous,
    revenueChangePercent,
    period,
  };
}

export async function getActivity(businessId, limit) {
  return { items: await listRecentActivity(businessId, limit) };
}

export async function getOwnerProfile(userId, businessId) {
  const profile = await getProfile(userId, businessId);
  if (!profile) {
    throw new ApiError(404, "Profile not found", [], "NOT_FOUND");
  }
  return profile;
}
