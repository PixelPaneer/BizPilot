import { pool } from "../config/db.js";
import { DEFAULT_CATEGORIES } from "../constants/index.js";

const SORT_EXPRESSIONS = {
  newest: "p.created_at DESC",
  name: "LOWER(p.product_name)",
  price_asc: "p.selling_price ASC",
  price_desc: "p.selling_price DESC",
  quantity: "i.available_quantity",
};

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function mapProduct(row) {
  const quantity = Number(row.available_quantity);
  const lowStockThreshold = Number(row.reorder_threshold);
  const lastAdjustment =
    row.adj_change === null || row.adj_change === undefined
      ? null
      : {
          type: Number(row.adj_change) > 0 ? "add" : "remove",
          amount: Math.abs(Number(row.adj_change)),
          date: row.adj_at,
        };

  return {
    id: row.product_id,
    name: row.product_name,
    category: row.category,
    unit: row.unit,
    price: Number(row.selling_price),
    costPrice:
      row.cost_price === null ? null : Number(row.cost_price),
    quantity,
    lowStockThreshold,
    status:
      quantity === 0
        ? "out-of-stock"
        : quantity <= lowStockThreshold
          ? "low-stock"
          : "in-stock",
    isActive: row.is_active,
    lastUpdated: row.last_updated,
    lastAdjustment,
  };
}

const PRODUCT_SELECT = `SELECT p.product_id, p.product_name, p.category, p.unit,
       p.selling_price, p.cost_price, p.is_active,
       i.available_quantity, i.reorder_threshold, i.last_updated,
       la.quantity_change AS adj_change, la.created_at AS adj_at
  FROM products p
  JOIN inventory i
    ON i.business_id = p.business_id AND i.product_id = p.product_id
  LEFT JOIN LATERAL (
    SELECT m.quantity_change, m.created_at
      FROM stock_movements m
     WHERE m.business_id = p.business_id
       AND m.product_id = p.product_id
       AND m.source = 'MANUAL'
       AND m.movement_type IN ('MANUAL_ADJUSTMENT', 'CORRECTION', 'DAMAGE')
     ORDER BY m.created_at DESC, m.movement_id DESC
     LIMIT 1
  ) la ON TRUE`;

export async function listProducts({
  businessId,
  search,
  category,
  status,
  sort = "newest",
  page = 1,
  limit = 100,
}) {
  const orderBy = SORT_EXPRESSIONS[sort] || SORT_EXPRESSIONS.newest;
  const escapedSearch =
    search === undefined ? null : escapeLike(search);
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    `SELECT p.product_id, p.product_name, p.category, p.unit,
            p.selling_price, p.cost_price, p.is_active,
            i.available_quantity, i.reorder_threshold, i.last_updated,
            la.quantity_change AS adj_change, la.created_at AS adj_at,
            COUNT(*) OVER() AS total_count
       FROM products p
       JOIN inventory i
         ON i.business_id = p.business_id AND i.product_id = p.product_id
       LEFT JOIN LATERAL (
         SELECT m.quantity_change, m.created_at
           FROM stock_movements m
          WHERE m.business_id = p.business_id
            AND m.product_id = p.product_id
            AND m.source = 'MANUAL'
            AND m.movement_type IN ('MANUAL_ADJUSTMENT', 'CORRECTION', 'DAMAGE')
          ORDER BY m.created_at DESC, m.movement_id DESC
          LIMIT 1
       ) la ON TRUE
      WHERE p.business_id = $1 AND p.is_active
        AND ($2::text IS NULL OR p.product_name ILIKE '%' || $2 || '%' ESCAPE E'\\\\')
        AND ($3::text IS NULL OR p.category = $3)
        AND ($4::text IS NULL OR
             (CASE WHEN i.available_quantity = 0 THEN 'out-of-stock'
                   WHEN i.available_quantity <= i.reorder_threshold THEN 'low-stock'
                   ELSE 'in-stock' END) = $4)
      ORDER BY ${orderBy}, p.product_id
      LIMIT $5 OFFSET $6`,
    [businessId, escapedSearch, category ?? null, status ?? null, limit, offset]
  );

  return {
    items: rows.map(mapProduct),
    total: rows.length === 0 ? 0 : Number(rows[0].total_count),
    page,
    limit,
  };
}

export async function getProductById(businessId, productId) {
  return getProductByIdWithExecutor(pool, businessId, productId);
}

async function getProductByIdWithExecutor(executor, businessId, productId) {
  const { rows } = await executor.query(
    `${PRODUCT_SELECT}
      WHERE p.business_id = $1 AND p.product_id = $2 AND p.is_active`,
    [businessId, productId]
  );
  return rows.length === 0 ? null : mapProduct(rows[0]);
}

export async function getProductByIdInTransaction(
  client,
  businessId,
  productId
) {
  return getProductByIdWithExecutor(client, businessId, productId);
}

export async function getProductStateForUpdate(client, businessId, productId) {
  const { rows } = await client.query(
    `SELECT p.product_id, p.product_name, p.category, p.unit,
            p.selling_price, p.cost_price, p.is_active,
            i.available_quantity, i.reorder_threshold, i.last_updated
       FROM products p
       JOIN inventory i
         ON i.business_id = p.business_id AND i.product_id = p.product_id
      WHERE p.business_id = $1 AND p.product_id = $2 AND p.is_active
      FOR UPDATE OF p, i`,
    [businessId, productId]
  );
  return rows[0] ?? null;
}

export async function insertProduct(client, businessId, product) {
  const { rows } = await client.query(
    `INSERT INTO products
       (business_id, product_name, category, unit, selling_price, cost_price)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING product_id`,
    [
      businessId,
      product.name,
      product.category,
      product.unit,
      product.price,
      product.costPrice ?? null,
    ]
  );
  return rows[0].product_id;
}

export async function updateProductFields(
  client,
  businessId,
  productId,
  fields
) {
  const columns = {
    name: "product_name",
    category: "category",
    unit: "unit",
    price: "selling_price",
    costPrice: "cost_price",
  };
  const assignments = [];
  const values = [businessId, productId];
  for (const [field, column] of Object.entries(columns)) {
    if (Object.hasOwn(fields, field)) {
      values.push(fields[field]);
      assignments.push(`${column} = $${values.length}`);
    }
  }
  assignments.push("updated_at = now()");
  await client.query(
    `UPDATE products
        SET ${assignments.join(", ")}
      WHERE business_id = $1 AND product_id = $2 AND is_active`,
    values
  );
}

export async function softDeleteProduct(client, businessId, productId) {
  const { rows } = await client.query(
    `UPDATE products
        SET is_active = FALSE, updated_at = now()
      WHERE business_id = $1 AND product_id = $2 AND is_active
      RETURNING product_name`,
    [businessId, productId]
  );
  return rows[0] ?? null;
}

export async function searchProducts(businessId, query, limit) {
  const { rows } = await pool.query(
    `WITH scored AS (
       SELECT p.product_id, p.product_name, p.category, p.unit,
              p.selling_price, p.cost_price, p.is_active,
              i.available_quantity, i.reorder_threshold, i.last_updated,
              la.quantity_change AS adj_change, la.created_at AS adj_at,
              GREATEST(
                similarity(LOWER(p.product_name), LOWER($2)),
                CASE WHEN POSITION(LOWER($2) IN LOWER(p.product_name)) > 0
                     THEN 0.9 ELSE 0 END
              ) AS score
         FROM products p
         JOIN inventory i
           ON i.business_id = p.business_id AND i.product_id = p.product_id
         LEFT JOIN LATERAL (
           SELECT m.quantity_change, m.created_at
             FROM stock_movements m
            WHERE m.business_id = p.business_id
              AND m.product_id = p.product_id
              AND m.source = 'MANUAL'
              AND m.movement_type IN ('MANUAL_ADJUSTMENT', 'CORRECTION', 'DAMAGE')
            ORDER BY m.created_at DESC, m.movement_id DESC
            LIMIT 1
         ) la ON TRUE
        WHERE p.business_id = $1 AND p.is_active
     )
     SELECT *
       FROM scored
      WHERE score > 0.25
      ORDER BY score DESC, LOWER(product_name), product_id
      LIMIT $3`,
    [businessId, query, limit]
  );
  return rows.map(mapProduct);
}

export async function listProductCategories(businessId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT category
       FROM products
      WHERE business_id = $1 AND is_active`,
    [businessId]
  );
  const categories = new Map(
    [...DEFAULT_CATEGORIES, ...rows.map((row) => row.category)].map(
      (category) => [category.toLocaleLowerCase(), category]
    )
  );
  return [...categories.values()].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}
