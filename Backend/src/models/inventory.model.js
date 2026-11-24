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

// Every active product with its stock and how many units it sold in the last `days` days
// (completed sales only). The reorder rules are applied in the service.
export async function listStockWithRecentSales(businessId, days) {
  const { rows } = await pool.query(
    `SELECT p.product_id,
            p.product_name,
            p.category,
            p.unit,
            i.available_quantity AS quantity,
            i.reorder_threshold,
            COALESCE(recent.units_sold, 0) AS units_sold
       FROM products p
       JOIN inventory i
         ON i.business_id = p.business_id
        AND i.product_id = p.product_id
       LEFT JOIN (
         SELECT si.product_id, SUM(si.quantity) AS units_sold
           FROM sale_items si
           JOIN sales s
             ON s.sale_id = si.sale_id
            AND s.business_id = si.business_id
          WHERE s.business_id = $1
            AND s.status = 'COMPLETED'
            AND s.sale_date >= now() - make_interval(days => $2::integer)
          GROUP BY si.product_id
       ) recent ON recent.product_id = p.product_id
      WHERE p.business_id = $1
        AND p.is_active`,
    [businessId, days]
  );
  return rows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    category: row.category,
    unit: row.unit,
    quantity: Number(row.quantity),
    reorderThreshold: Number(row.reorder_threshold),
    unitsSold: Number(row.units_sold),
  }));
}
