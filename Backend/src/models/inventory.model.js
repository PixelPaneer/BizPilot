import { pool } from "../config/db.js";

export async function insertInventory(
  client,
  businessId,
  productId,
  threshold
) {
  await client.query(
    `INSERT INTO inventory
       (business_id, product_id, available_quantity, reorder_threshold)
     VALUES ($1, $2, 0, $3)`,
    [businessId, productId, threshold]
  );
}

export async function updateReorderThreshold(
  client,
  businessId,
  productId,
  threshold
) {
  await client.query(
    `UPDATE inventory
        SET reorder_threshold = $3
      WHERE business_id = $1 AND product_id = $2`,
    [businessId, productId, threshold]
  );
}

export async function getInventorySummary(businessId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::integer AS total,
            COUNT(*) FILTER (WHERE i.available_quantity > i.reorder_threshold)::integer
              AS in_stock,
            COUNT(*) FILTER (
              WHERE i.available_quantity > 0
                AND i.available_quantity <= i.reorder_threshold
            )::integer AS low_stock,
            COUNT(*) FILTER (WHERE i.available_quantity = 0)::integer
              AS out_of_stock
       FROM products p
       JOIN inventory i
         ON i.business_id = p.business_id AND i.product_id = p.product_id
      WHERE p.business_id = $1 AND p.is_active`,
    [businessId]
  );
  const row = rows[0];
  return {
    total: Number(row.total),
    inStock: Number(row.in_stock),
    lowStock: Number(row.low_stock),
    outOfStock: Number(row.out_of_stock),
  };
}
