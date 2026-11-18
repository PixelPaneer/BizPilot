import { withTransaction } from "../config/db.js";
import { listAlerts } from "../models/alert.model.js";
import { getInventorySummary } from "../models/inventory.model.js";
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
