import { pool } from "../config/db.js";

// How alike a product name must be to the search words to be returned at all.
export const MIN_SCORE = 0.25;
// A name that contains the search words (after ignoring punctuation and letter case) scores this.
const CONTAINS_SCORE = 0.9;

// Searches ONE shop's active products by approximate name. `normalized` is the search text with
// letter case and punctuation already flattened (see catalog.service.js) and `likePattern` is the
// same text with LIKE's wildcard characters escaped.
//
// Only what a customer may be told is selected: no cost price and no quantity. The stock status is
// worked out here, with the same rule as everywhere else (zero is out, at or below the minimum is
// limited).
export async function searchActiveProducts(businessId, normalized, likePattern, limit) {
  const { rows } = await pool.query(
    `SELECT *
       FROM (
         SELECT p.product_id,
                p.product_name,
                p.category,
                p.unit,
                p.selling_price,
                CASE
                  WHEN i.available_quantity = 0 THEN 'out'
                  WHEN i.available_quantity <= i.reorder_threshold THEN 'limited'
                  ELSE 'available'
                END AS stock_status,
                GREATEST(
                  similarity(names.flat_name, $2),
                  CASE WHEN names.flat_name LIKE '%' || $3 || '%' ESCAPE '\\' THEN ${CONTAINS_SCORE} ELSE 0 END,
                  CASE WHEN lower(p.product_name) LIKE '%' || $3 || '%' ESCAPE '\\' THEN ${CONTAINS_SCORE} ELSE 0 END
                ) AS score
           FROM products p
           JOIN inventory i
             ON i.business_id = p.business_id
            AND i.product_id = p.product_id
          CROSS JOIN LATERAL (
                SELECT btrim(
                         regexp_replace(
                           regexp_replace(lower(p.product_name), '[-_./,()'']+', ' ', 'g'),
                           '\\s+', ' ', 'g'
                         )
                       ) AS flat_name
          ) names
          WHERE p.business_id = $1
            AND p.is_active
       ) scored
      WHERE score > ${MIN_SCORE}
      ORDER BY score DESC, product_name ASC
      LIMIT $4`,
    [businessId, normalized, likePattern, limit]
  );

  return rows.map((row) => ({
    productId: row.product_id,
    name: row.product_name,
    category: row.category,
    unit: row.unit,
    price: Number(row.selling_price),
    status: row.stock_status,
    similarity: Math.round(Number(row.score) * 100) / 100,
  }));
}
