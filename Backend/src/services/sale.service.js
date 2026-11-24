import { withTransaction } from "../config/db.js";
import { BILL_SOURCE_LABELS } from "../constants/index.js";
import { insertAuditLog } from "../models/audit.model.js";
import {
  findSaleResponseByKey,
  getProductsForBill,
  getSaleDetail,
  getSaleForUpdate,
  insertSale,
  insertSaleItem,
  lockBusinessBills,
  markSaleVoided,
  nextSaleNumber,
  saveSaleResponse,
} from "../models/sale.model.js";
import { listSaleDeductions } from "../models/stockMovement.model.js";
import { ApiError } from "../utils/ApiError.js";
import { fromPaise, istDateCompact, lineTotalPaise, toMilli } from "../utils/money.js";
import { applyStockChange } from "./stock.service.js";

function itemsText(count) {
  return `${count} item${count === 1 ? "" : "s"}`;
}

// Records a sale: saves the sale and its lines, and takes the sold quantity out of stock, all in
// one transaction. A retry with the same idempotencyKey returns the first result unchanged.
// Returns { created, result }; created is false when the key was already used.
export async function recordSale(businessId, userId, payload) {
  return withTransaction(async (client) => {
    await lockBusinessBills(client, businessId);

    const existing = await findSaleResponseByKey(client, businessId, payload.idempotencyKey);
    if (existing) {
      const result =
        existing.response ?? (await getSaleDetail(client, businessId, existing.sale_id));
      return { created: false, result };
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

    // A sale larger than the recorded stock is refused unless the owner explicitly allows it.
    const shortfalls = lines.filter(
      (line) => toMilli(line.quantity) > toMilli(products.get(line.productId).available)
    );
    if (shortfalls.length > 0 && !payload.allowOversell) {
      throw new ApiError(
        409,
        "Not enough stock for this sale",
        shortfalls.map((line) => ({
          productId: line.productId,
          productName: products.get(line.productId).name,
          requested: line.quantity,
          available: products.get(line.productId).available,
        })),
        "INSUFFICIENT_STOCK"
      );
    }

    const lineRevenues = lines.map((line) => lineTotalPaise(line.quantity, line.unitPrice));
    const totalPaise = lineRevenues.reduce((sum, paise) => sum + paise, 0);
    const totalAmount = fromPaise(totalPaise);

    const saleNumber = await nextSaleNumber(client, businessId, istDateCompact());
    const sale = await insertSale(client, {
      businessId,
      saleNumber,
      source: payload.source,
      total: totalAmount,
      idempotencyKey: payload.idempotencyKey,
    });

    const resultLines = [];
    const warnings = [];
    for (const [index, line] of lines.entries()) {
      const product = products.get(line.productId);
      await insertSaleItem(client, {
        businessId,
        saleId: sale.sale_id,
        productId: line.productId,
        productName: product.name,
        category: product.category,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitCost: product.costPrice,
        revenue: fromPaise(lineRevenues[index]),
      });

      // Take out what is actually in stock. If the shop's records were behind, stock goes to 0
      // and the difference is reported as a shortfall (stock never goes negative).
      const requestedMilli = toMilli(line.quantity);
      const deductMilli = Math.min(requestedMilli, toMilli(product.available));
      const shortfall = (requestedMilli - deductMilli) / 1000;
      let newQuantity = product.available;
      if (deductMilli > 0) {
        const change = await applyStockChange(client, {
          businessId,
          productId: line.productId,
          delta: -deductMilli / 1000,
          movementType: "SALE",
          source: payload.source,
          userId,
          referenceId: sale.sale_id,
          skipAudit: true,
        });
        newQuantity = change.next;
      }
      if (shortfall > 0) {
        warnings.push(
          `Stock for ${product.name} was lower than recorded; it was set to 0. Please check your stock.`
        );
      }
      resultLines.push({
        productId: line.productId,
        productName: product.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        newQuantity,
        shortfall,
      });
    }

    await insertAuditLog(client, {
      businessId,
      userId,
      actionType: "BILL_CONFIRMED",
      entityType: "SALE",
      entityId: sale.sale_id,
      description: `${saleNumber}  •  ${itemsText(lines.length)}  •  ₹${totalAmount}  •  ${BILL_SOURCE_LABELS[payload.source] ?? BILL_SOURCE_LABELS.MANUAL}`,
      outcome: "SUCCESS",
    });

    const result = {
      saleId: sale.sale_id,
      saleNumber,
      status: "COMPLETED",
      totalAmount,
      lines: resultLines,
      warnings,
    };
    await saveSaleResponse(client, businessId, sale.sale_id, result);
    return { created: true, result };
  });
}

// Voids a sale: puts back exactly the stock the sale took out, and removes the sale from all
// reports (reports only count COMPLETED sales). Returns the updated sale with any warnings.
export async function voidSale(businessId, userId, saleId, reason) {
  return withTransaction(async (client) => {
    await lockBusinessBills(client, businessId);

    const sale = await getSaleForUpdate(client, businessId, saleId);
    if (!sale) {
      throw new ApiError(404, "Sale not found", [], "NOT_FOUND");
    }
    if (sale.status === "VOIDED") {
      throw new ApiError(409, "This sale has already been voided", [], "SALE_ALREADY_VOIDED");
    }

    const warnings = [];
    const deductions = await listSaleDeductions(client, businessId, saleId);
    for (const deduction of deductions) {
      if (deduction.deducted <= 0) continue;
      if (!deduction.isActive) {
        warnings.push(`${deduction.productName} was deleted, so its stock was not restored.`);
        continue;
      }
      await applyStockChange(client, {
        businessId,
        productId: deduction.productId,
        delta: deduction.deducted,
        movementType: "RETURN",
        source: "MANUAL",
        userId,
        referenceId: saleId,
        skipAudit: true,
      });
    }

    await markSaleVoided(client, { businessId, saleId, userId, reason });
    await insertAuditLog(client, {
      businessId,
      userId,
      actionType: "SALE_VOIDED",
      entityType: "SALE",
      entityId: saleId,
      description: `${sale.sale_number} voided  •  ${reason}`,
      outcome: "SUCCESS",
    });

    const detail = await getSaleDetail(client, businessId, saleId);
    return { ...detail, warnings };
  });
}
