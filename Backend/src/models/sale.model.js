// SQL for sales, sale items and purchase batches. All functions take the transaction client.

// Serialises bill operations (sale / purchase / void) per business, so sale numbers and
// idempotency checks cannot race. The lock is released automatically at COMMIT / ROLLBACK.
export async function lockBusinessBills(client, businessId) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [businessId]);
}

// Loads (and row-locks the stock of) the products on a bill, in a fixed order.
export async function getProductsForBill(client, businessId, productIds) {
  const { rows } = await client.query(
    `SELECT p.product_id, p.product_name, p.category, p.selling_price, p.cost_price,
            i.available_quantity
       FROM products p
       JOIN inventory i
         ON i.business_id = p.business_id AND i.product_id = p.product_id
      WHERE p.business_id = $1 AND p.product_id = ANY($2::uuid[]) AND p.is_active
      ORDER BY p.product_id
        FOR UPDATE OF i`,
    [businessId, productIds]
  );
  return new Map(
    rows.map((row) => [
      row.product_id,
      {
        productId: row.product_id,
        name: row.product_name,
        category: row.category,
        sellingPrice: Number(row.selling_price),
        costPrice: row.cost_price === null ? null : Number(row.cost_price),
        available: Number(row.available_quantity),
      },
    ])
  );
}

export async function setProductCostPrice(client, businessId, productId, costPrice) {
  await client.query(
    `UPDATE products
        SET cost_price = $3, updated_at = now()
      WHERE business_id = $1 AND product_id = $2`,
    [businessId, productId, costPrice]
  );
}

export async function findSaleResponseByKey(client, businessId, idempotencyKey) {
  const { rows } = await client.query(
    `SELECT sale_id, response
       FROM sales
      WHERE business_id = $1 AND idempotency_key = $2`,
    [businessId, idempotencyKey]
  );
  return rows[0] ?? null;
}

// Next sale number for a day: SL-YYYYMMDD-0001, SL-YYYYMMDD-0002, ...
export async function nextSaleNumber(client, businessId, dateCompact) {
  const prefix = `SL-${dateCompact}-`;
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(SUBSTRING(sale_number FROM $3::integer)::integer), 0) AS last
       FROM sales
      WHERE business_id = $1 AND sale_number LIKE $2 || '%'`,
    [businessId, prefix, prefix.length + 1]
  );
  return `${prefix}${String(Number(rows[0].last) + 1).padStart(4, "0")}`;
}

export async function insertSale(client, sale) {
  const { rows } = await client.query(
    `INSERT INTO sales
       (business_id, sale_number, source, subtotal, discount_amount, tax_amount,
        total_amount, status, idempotency_key)
     VALUES ($1, $2, $3, $4, 0, 0, $4, 'COMPLETED', $5)
     RETURNING sale_id, sale_date`,
    [
      sale.businessId,
      sale.saleNumber,
      sale.source,
      sale.total,
      sale.idempotencyKey,
    ]
  );
  return rows[0];
}

export async function insertSaleItem(client, item) {
  await client.query(
    `INSERT INTO sale_items
       (business_id, sale_id, product_id, product_name_snapshot, category_snapshot,
        quantity, unit_selling_price, unit_cost_at_sale, discount_amount, tax_amount, revenue)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, $9)`,
    [
      item.businessId,
      item.saleId,
      item.productId,
      item.productName,
      item.category,
      item.quantity,
      item.unitPrice,
      item.unitCost,
      item.revenue,
    ]
  );
}

export async function saveSaleResponse(client, businessId, saleId, response) {
  await client.query(
    `UPDATE sales SET response = $3 WHERE business_id = $1 AND sale_id = $2`,
    [businessId, saleId, JSON.stringify(response)]
  );
}

// Locks the sale row (used by void so two voids cannot run at once).
export async function getSaleForUpdate(client, businessId, saleId) {
  const { rows } = await client.query(
    `SELECT sale_id, sale_number, status
       FROM sales
      WHERE business_id = $1 AND sale_id = $2
        FOR UPDATE`,
    [businessId, saleId]
  );
  return rows[0] ?? null;
}

export async function markSaleVoided(client, { businessId, saleId, userId, reason }) {
  await client.query(
    `UPDATE sales
        SET status = 'VOIDED', voided_at = now(), void_reason = $3,
            voided_by = $4, updated_at = now()
      WHERE business_id = $1 AND sale_id = $2`,
    [businessId, saleId, reason, userId ?? null]
  );
}

export async function getSaleDetail(client, businessId, saleId) {
  const { rows } = await client.query(
    `SELECT sale_id, sale_number, sale_date, source, status, subtotal, total_amount,
            voided_at, void_reason
       FROM sales
      WHERE business_id = $1 AND sale_id = $2`,
    [businessId, saleId]
  );
  if (rows.length === 0) return null;
  const sale = rows[0];
  const items = await client.query(
    `SELECT product_id, product_name_snapshot, category_snapshot, quantity,
            unit_selling_price, unit_cost_at_sale, revenue
       FROM sale_items
      WHERE business_id = $1 AND sale_id = $2
      ORDER BY product_name_snapshot, product_id`,
    [businessId, saleId]
  );
  return {
    id: sale.sale_id,
    saleNumber: sale.sale_number,
    saleDate: sale.sale_date,
    source: sale.source,
    status: sale.status,
    subtotal: Number(sale.subtotal),
    totalAmount: Number(sale.total_amount),
    voidedAt: sale.voided_at,
    voidReason: sale.void_reason,
    items: items.rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name_snapshot,
      category: row.category_snapshot,
      quantity: Number(row.quantity),
      unitSellingPrice: Number(row.unit_selling_price),
      unitCostAtSale: row.unit_cost_at_sale === null ? null : Number(row.unit_cost_at_sale),
      revenue: Number(row.revenue),
    })),
  };
}

// ---- purchase batches (stock received) ----

export async function findPurchaseResponseByKey(client, businessId, idempotencyKey) {
  const { rows } = await client.query(
    `SELECT batch_id, response
       FROM purchase_batches
      WHERE business_id = $1 AND idempotency_key = $2`,
    [businessId, idempotencyKey]
  );
  return rows[0] ?? null;
}

export async function insertPurchaseBatch(client, { businessId, idempotencyKey, source }) {
  const { rows } = await client.query(
    `INSERT INTO purchase_batches (business_id, idempotency_key, source)
     VALUES ($1, $2, $3)
     RETURNING batch_id`,
    [businessId, idempotencyKey, source]
  );
  return rows[0].batch_id;
}

export async function savePurchaseResponse(client, businessId, batchId, response) {
  await client.query(
    `UPDATE purchase_batches SET response = $3 WHERE business_id = $1 AND batch_id = $2`,
    [businessId, batchId, JSON.stringify(response)]
  );
}
