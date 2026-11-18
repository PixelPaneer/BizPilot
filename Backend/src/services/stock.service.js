import { ApiError } from "../utils/ApiError.js";
import { insertAuditLog } from "../models/audit.model.js";
import { insertStockMovement } from "../models/stockMovement.model.js";
import { syncAlerts } from "./alert.service.js";

function formatQuantity(quantity) {
  return Number(quantity).toString();
}

export async function applyStockChange(
  client,
  { businessId, productId, delta, movementType, source, userId, skipAudit }
) {
  const { rows } = await client.query(
    `SELECT i.available_quantity, p.product_name
       FROM inventory i
       JOIN products p
         ON p.business_id = i.business_id AND p.product_id = i.product_id
      WHERE i.business_id = $1 AND i.product_id = $2 AND p.is_active
      FOR UPDATE OF i`,
    [businessId, productId]
  );
  if (rows.length === 0) {
    throw new ApiError(404, "Product not found", [], "NOT_FOUND");
  }

  const previousQuantity = Number(rows[0].available_quantity);
  const productName = rows[0].product_name;
  const requestedChange = Number(delta);
  const scaledChange = Math.round(requestedChange * 1000);
  if (
    !Number.isFinite(requestedChange) ||
    requestedChange === 0 ||
    Math.abs(requestedChange * 1000 - scaledChange) > 1e-8 ||
    scaledChange === 0
  ) {
    throw new ApiError(
      400,
      "Stock change must be a non-zero number with at most 3 decimal places",
      [],
      "VALIDATION_ERROR"
    );
  }

  const previousMilli = Math.round(previousQuantity * 1000);
  const previous = previousMilli / 1000;
  const change = scaledChange / 1000;
  const next = (previousMilli + scaledChange) / 1000;
  if (next < 0) {
    throw new ApiError(
      409,
      "Insufficient stock",
      [{ productId, requested: Math.abs(change), available: previous }],
      "INSUFFICIENT_STOCK"
    );
  }

  await insertStockMovement(client, {
    businessId,
    productId,
    delta: change,
    previous,
    next,
    movementType,
    source,
    userId,
  });
  await client.query(
    `UPDATE inventory
        SET available_quantity = $3, last_updated = now()
      WHERE business_id = $1 AND product_id = $2`,
    [businessId, productId, next]
  );
  await syncAlerts(client, businessId, productId);

  if (!skipAudit) {
    const signedDelta = change > 0 ? `+${formatQuantity(change)}` : formatQuantity(change);
    await insertAuditLog(client, {
      businessId,
      userId,
      actionType: change > 0 ? "STOCK_ADDED" : "STOCK_REMOVED",
      entityType: "PRODUCT",
      entityId: productId,
      description: `${productName}  •  ${signedDelta} units (New stock: ${formatQuantity(next)})`,
      outcome: "SUCCESS",
    });
  }

  return { previous, next, productName };
}
