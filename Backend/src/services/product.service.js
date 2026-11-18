import { withTransaction } from "../config/db.js";
import { insertAuditLog } from "../models/audit.model.js";
import {
  insertInventory,
  updateReorderThreshold,
} from "../models/inventory.model.js";
import { ApiError } from "../utils/ApiError.js";
import {
  getProductById as findProductById,
  getProductByIdInTransaction,
  getProductStateForUpdate,
  insertProduct,
  listProductCategories,
  listProducts as findProducts,
  searchProducts as findProductsBySearch,
  softDeleteProduct,
  updateProductFields,
} from "../models/product.model.js";
import { applyStockChange } from "./stock.service.js";
import { syncAlerts } from "./alert.service.js";

function throwProductWriteError(error) {
  if (error.code === "23505" && error.constraint === "uq_products_active_name") {
    throw new ApiError(
      409,
      "A product with this name already exists",
      [],
      "DUPLICATE_PRODUCT"
    );
  }
  throw error;
}

export async function createProduct(businessId, userId, product) {
  try {
    return await withTransaction(async (client) => {
      const productId = await insertProduct(client, businessId, product);
      await insertInventory(
        client,
        businessId,
        productId,
        product.lowStockThreshold
      );
      if (product.quantity > 0) {
        await applyStockChange(client, {
          businessId,
          productId,
          delta: product.quantity,
          movementType: "MANUAL_ADJUSTMENT",
          source: "SYSTEM",
          userId: null,
          skipAudit: true,
        });
      }
      await insertAuditLog(client, {
        businessId,
        userId,
        actionType: "PRODUCT_CREATED",
        entityType: "PRODUCT",
        entityId: productId,
        description: `${product.name}  •  ₹${Number(product.price).toString()}`,
        outcome: "SUCCESS",
      });
      await syncAlerts(client, businessId, productId);
      return getProductByIdInTransaction(client, businessId, productId);
    });
  } catch (error) {
    throwProductWriteError(error);
  }
}

export async function updateProduct(businessId, userId, productId, changes) {
  try {
    return await withTransaction(async (client) => {
      const current = await getProductStateForUpdate(
        client,
        businessId,
        productId
      );
      if (!current) {
        throw new ApiError(404, "Product not found", [], "NOT_FOUND");
      }

      const productFields = {};
      for (const field of ["name", "category", "unit", "price", "costPrice"]) {
        if (Object.hasOwn(changes, field)) {
          productFields[field] = changes[field];
        }
      }
      const quantityChanged =
        Object.hasOwn(changes, "quantity") &&
        Number(changes.quantity) !== Number(current.available_quantity);
      const thresholdChanged =
        Object.hasOwn(changes, "lowStockThreshold") &&
        Number(changes.lowStockThreshold) !== Number(current.reorder_threshold);

      await updateProductFields(
        client,
        businessId,
        productId,
        productFields
      );
      if (thresholdChanged) {
        await updateReorderThreshold(
          client,
          businessId,
          productId,
          changes.lowStockThreshold
        );
      }
      if (quantityChanged) {
        await applyStockChange(client, {
          businessId,
          productId,
          delta: Number(changes.quantity) - Number(current.available_quantity),
          movementType: "MANUAL_ADJUSTMENT",
          source: "MANUAL",
          userId,
        });
      } else if (thresholdChanged) {
        await syncAlerts(client, businessId, productId);
      }

      return getProductByIdInTransaction(client, businessId, productId);
    });
  } catch (error) {
    throwProductWriteError(error);
  }
}

export async function deleteProduct(businessId, userId, productId) {
  return withTransaction(async (client) => {
    const current = await getProductStateForUpdate(
      client,
      businessId,
      productId
    );
    if (!current) {
      throw new ApiError(404, "Product not found", [], "NOT_FOUND");
    }

    await softDeleteProduct(client, businessId, productId);
    await syncAlerts(client, businessId, productId);
    await insertAuditLog(client, {
      businessId,
      userId,
      actionType: "PRODUCT_DELETED",
      entityType: "PRODUCT",
      entityId: productId,
      description: `${current.product_name} deleted`,
      outcome: "SUCCESS",
    });
    return null;
  });
}

export async function listProducts(businessId, filters) {
  return findProducts({
    businessId,
    search: filters.search?.trim() || undefined,
    category: filters.category || undefined,
    status: filters.status || undefined,
    sort: filters.sort || "newest",
    page: Number(filters.page || 1),
    limit: Number(filters.limit || 100),
  });
}

export async function searchProducts(businessId, { q, limit }) {
  const items = await findProductsBySearch(
    businessId,
    q.trim(),
    Number(limit || 10)
  );
  return { items };
}

export async function getProduct(businessId, productId) {
  const product = await findProductById(businessId, productId);
  if (!product) {
    throw new ApiError(404, "Product not found", [], "NOT_FOUND");
  }
  return product;
}

export async function getProductCategories(businessId) {
  return { items: await listProductCategories(businessId) };
}
