import { pool } from "../config/db.js";

export async function insertStockMovement(client, {
  businessId,
  productId,
  delta,
  previous,
  next,
  movementType,
  source,
  userId,
}) {
  const { rows } = await client.query(
    `INSERT INTO stock_movements
       (business_id, product_id, movement_type, quantity_change,
        previous_quantity, new_quantity, source, user_id, reference_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
     RETURNING movement_id`,
    [
      businessId,
      productId,
      movementType,
      delta,
      previous,
      next,
      source,
      userId ?? null,
    ]
  );
  return rows[0].movement_id;
}

export async function listStockHistory(
  businessId,
  productId,
  { from, to, limit }
) {
  const { rows } = await pool.query(
    `SELECT m.movement_id, m.product_id, p.product_name, m.movement_type,
            m.quantity_change, m.previous_quantity, m.new_quantity,
            m.source, m.created_at
       FROM stock_movements m
       JOIN products p
         ON p.business_id = m.business_id AND p.product_id = m.product_id
      WHERE m.business_id = $1 AND m.product_id = $2 AND p.is_active
        AND ($3::date IS NULL OR
             m.created_at >= ($3::date::timestamp AT TIME ZONE 'Asia/Kolkata'))
        AND ($4::date IS NULL OR
             m.created_at < (($4::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'))
      ORDER BY m.created_at DESC, m.movement_id DESC
      LIMIT $5`,
    [businessId, productId, from ?? null, to ?? null, limit]
  );
  return rows.map((row) => ({
    id: row.movement_id,
    productId: row.product_id,
    productName: row.product_name,
    type: row.movement_type,
    quantityChange: Number(row.quantity_change),
    previousQuantity: Number(row.previous_quantity),
    newQuantity: Number(row.new_quantity),
    source: row.source,
    createdAt: row.created_at,
  }));
}
