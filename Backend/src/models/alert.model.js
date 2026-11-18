import { pool } from "../config/db.js";

export async function getAlertInventory(client, businessId, productId) {
  const { rows } = await client.query(
    `SELECT i.available_quantity, i.reorder_threshold
       FROM inventory i
       JOIN products p
         ON p.business_id = i.business_id AND p.product_id = i.product_id
      WHERE i.business_id = $1 AND i.product_id = $2 AND p.is_active`,
    [businessId, productId]
  );
  return rows[0] ?? null;
}

export async function resolveActiveAlerts(client, businessId, productId, alertType) {
  await client.query(
    `UPDATE inventory_alerts
        SET status = 'RESOLVED', resolved_at = now()
      WHERE business_id = $1 AND product_id = $2 AND status = 'ACTIVE'
        AND ($3::text IS NULL OR alert_type <> $3)`,
    [businessId, productId, alertType ?? null]
  );
}

export async function insertActiveAlert(
  client,
  businessId,
  productId,
  alertType,
  quantity,
  threshold
) {
  await client.query(
    `INSERT INTO inventory_alerts
       (business_id, product_id, alert_type, current_quantity, reorder_threshold)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (business_id, product_id, alert_type)
       WHERE status = 'ACTIVE'
     DO NOTHING`,
    [businessId, productId, alertType, quantity, threshold]
  );
  await client.query(
    `UPDATE inventory_alerts
        SET current_quantity = $4, reorder_threshold = $5
      WHERE business_id = $1 AND product_id = $2
        AND alert_type = $3 AND status = 'ACTIVE'`,
    [businessId, productId, alertType, quantity, threshold]
  );
}

export async function listAlerts(businessId, status) {
  const { rows } = await pool.query(
    `SELECT a.alert_id, a.product_id, p.product_name, a.alert_type,
            a.current_quantity, a.reorder_threshold, a.status, a.created_at
       FROM inventory_alerts a
       JOIN products p
         ON p.business_id = a.business_id AND p.product_id = a.product_id
      WHERE a.business_id = $1 AND a.status = $2 AND p.is_active
      ORDER BY a.created_at DESC, a.alert_id DESC`,
    [businessId, status]
  );
  return rows.map((row) => ({
    id: row.alert_id,
    productId: row.product_id,
    productName: row.product_name,
    type: row.alert_type,
    currentQuantity: Number(row.current_quantity),
    reorderThreshold: Number(row.reorder_threshold),
    status: row.status,
    createdAt: row.created_at,
  }));
}
