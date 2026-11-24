import { withTransaction } from "../config/db.js";
import { listAlerts } from "../models/alert.model.js";
import { getInventorySummary, listStockWithRecentSales } from "../models/inventory.model.js";
import {
  getProductById,
  getProductByIdInTransaction,
  getProductStateForUpdate,
} from "../models/product.model.js";
import { listStockHistory } from "../models/stockMovement.model.js";
import { ApiError } from "../utils/ApiError.js";
import { applyStockChange } from "./stock.service.js";
import { listProducts } from "./product.service.js";

export async function getInventory(businessId, filters) {
  return listProducts(businessId, filters);
}

export async function getSummary(businessId) {
  return getInventorySummary(businessId);
}

export async function getAlerts(businessId, status = "ACTIVE") {
  return { items: await listAlerts(businessId, status) };
}

export async function adjustInventory(
  businessId,
  userId,
  productId,
  adjustment
) {
  return withTransaction(async (client) => {
    const current = await getProductStateForUpdate(
      client,
      businessId,
      productId
    );
    if (!current) {
      throw new ApiError(404, "Product not found", [], "NOT_FOUND");
    }

    const currentQuantity = Number(current.available_quantity);
    let delta;
    let movementType;
    if (Object.hasOwn(adjustment, "quantity")) {
      delta = Number(adjustment.quantity) - currentQuantity;
      movementType = "CORRECTION";
    } else {
      delta = adjustment.type === "add"
        ? Number(adjustment.amount)
        : -Number(adjustment.amount);
      movementType = adjustment.reason || "MANUAL_ADJUSTMENT";
    }

    if (delta !== 0) {
      await applyStockChange(client, {
        businessId,
        productId,
        delta,
        movementType,
        source: "MANUAL",
        userId,
      });
    }
    return getProductByIdInTransaction(client, businessId, productId);
  });
}

export async function getHistory(businessId, productId, filters) {
  const product = await getProductById(businessId, productId);
  if (!product) {
    throw new ApiError(404, "Product not found", [], "NOT_FOUND");
  }
  return {
    items: await listStockHistory(businessId, productId, {
      from: filters.from,
      to: filters.to,
      limit: Number(filters.limit || 50),
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// Reorder suggestions
// ---------------------------------------------------------------------------------------------

// A product is suggested when it is out of stock, at or below its minimum, or (judging by how
// fast it sells) will run out within this many days.
const RUNNING_OUT_DAYS = 7;
// The suggested order brings stock up to this many days of sales, and never to less than twice the
// product's minimum.
const COVER_DAYS = 14;

const oneDecimal = (value) => Math.round(value * 10) / 10;

// Pure rule, kept apart from the SQL so it can be tested on its own. `stock` is one row from
// listStockWithRecentSales; returns the suggestion, or null when the product is fine.
export function reorderSuggestionFor(stock, days) {
  const dailySales = stock.unitsSold / days;
  const daysOfStockLeft = dailySales > 0 ? stock.quantity / dailySales : null;

  let reason = null;
  if (stock.quantity === 0) reason = "OUT_OF_STOCK";
  else if (stock.quantity <= stock.reorderThreshold) reason = "LOW_STOCK";
  else if (daysOfStockLeft !== null && daysOfStockLeft <= RUNNING_OUT_DAYS) reason = "RUNNING_OUT";
  if (!reason) return null;

  const target = Math.max(dailySales * COVER_DAYS, stock.reorderThreshold * 2);
  const suggestedQuantity = Math.max(1, Math.ceil(target - stock.quantity));

  return {
    productId: stock.productId,
    productName: stock.productName,
    category: stock.category,
    unit: stock.unit,
    quantity: stock.quantity,
    reorderThreshold: stock.reorderThreshold,
    unitsSold: stock.unitsSold,
    weeklySales: oneDecimal(dailySales * 7),
    daysOfStockLeft: daysOfStockLeft === null ? null : oneDecimal(daysOfStockLeft),
    suggestedQuantity,
    reason,
  };
}

// What to order, most urgent first: out-of-stock products that sell well, then the products that
// will run out soonest. `days` is how much sales history the pace is judged on.
export async function getReorderSuggestions(businessId, { days = 30, limit = 10 } = {}) {
  const stock = await listStockWithRecentSales(businessId, days);

  const suggestions = stock
    .map((row) => reorderSuggestionFor(row, days))
    .filter(Boolean)
    .sort((a, b) => {
      const aOut = a.reason === "OUT_OF_STOCK" ? 0 : 1;
      const bOut = b.reason === "OUT_OF_STOCK" ? 0 : 1;
      if (aOut !== bOut) return aOut - bOut;
      if (aOut === 0) return b.unitsSold - a.unitsSold || a.productName.localeCompare(b.productName);
      const aLeft = a.daysOfStockLeft ?? Infinity;
      const bLeft = b.daysOfStockLeft ?? Infinity;
      return aLeft - bLeft || a.quantity - b.quantity || a.productName.localeCompare(b.productName);
    });

  return { days, total: suggestions.length, items: suggestions.slice(0, limit) };
}
