import { withTransaction } from "../config/db.js";
import { BILL_SOURCE_LABELS } from "../constants/index.js";
import { insertAuditLog } from "../models/audit.model.js";
import {
  findPurchaseResponseByKey,
  getProductsForBill,
  insertPurchaseBatch,
  lockBusinessBills,
  savePurchaseResponse,
  setProductCostPrice,
} from "../models/sale.model.js";
import { ApiError } from "../utils/ApiError.js";
import { fromPaise, lineTotalPaise } from "../utils/money.js";
import { applyStockChange } from "./stock.service.js";

// Records stock received from a supplier: raises stock and sets each product's cost price to
// the price paid on this purchase (the latest purchase price). A retry with the same
// idempotencyKey returns the first result unchanged.
// Returns { created, result }; created is false when the key was already used.
export async function recordPurchase(businessId, userId, payload) {
  return withTransaction(async (client) => {
    await lockBusinessBills(client, businessId);

    const existing = await findPurchaseResponseByKey(client, businessId, payload.idempotencyKey);
    if (existing) {
      return { created: false, result: existing.response };
    }

    const lines = payload.lines;
    const products = await getProductsForBill(
      client,
      businessId,
      lines.map((line) => line.productId)
    );
    const missing = lines.filter((line) => !products.has(line.productId));
    if (missing.length > 0) {
      throw new ApiError(
        404,
        "One or more products were not found",
        missing.map((line) => ({ productId: line.productId })),
        "NOT_FOUND"
      );
    }

    const batchId = await insertPurchaseBatch(client, {
      businessId,
      idempotencyKey: payload.idempotencyKey,
      source: payload.source,
    });

    let totalPaise = 0;
    const resultLines = [];
    for (const line of lines) {
      const product = products.get(line.productId);
      totalPaise += lineTotalPaise(line.quantity, line.unitPrice);

      const change = await applyStockChange(client, {
        businessId,
        productId: line.productId,
        delta: line.quantity,
        movementType: "PURCHASE",
        source: payload.source,
        userId,
        referenceId: batchId,
        skipAudit: true,
      });
      await setProductCostPrice(client, businessId, line.productId, line.unitPrice);

      resultLines.push({
        productId: line.productId,
        productName: product.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        newQuantity: change.next,
      });
    }

    const totalAmount = fromPaise(totalPaise);
    await insertAuditLog(client, {
      businessId,
      userId,
      actionType: "BILL_CONFIRMED",
      entityType: "PURCHASE",
      entityId: batchId,
      description: `Purchase  •  ${lines.length} item${lines.length === 1 ? "" : "s"}  •  ₹${totalAmount}  •  ${BILL_SOURCE_LABELS[payload.source] ?? BILL_SOURCE_LABELS.MANUAL}`,
      outcome: "SUCCESS",
    });

    const result = { purchaseId: batchId, totalAmount, lines: resultLines, warnings: [] };
    await savePurchaseResponse(client, businessId, batchId, result);
    return { created: true, result };
  });
}
