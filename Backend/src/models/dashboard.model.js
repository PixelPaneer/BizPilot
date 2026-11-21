import { pool } from "../config/db.js";

// How each dashboard period is cut. A week starts on Monday (Postgres date_trunc('week')).
// "previous" is the same stretch of the previous week/month/year, so a half-finished month is
// compared with the first half of last month, not with all of it.
export const PERIODS = {
  this_week: { truncate: "week", back: "1 week" },
  this_month: { truncate: "month", back: "1 month" },
  this_year: { truncate: "year", back: "1 year" },
};

// Revenue (completed sales only; voided sales are left out) for the current period so far and
// for the matching stretch of the previous period. All boundaries are in India time.
export async function getRevenueComparison(businessId, period) {
  const { truncate, back } = PERIODS[period];
  const { rows } = await pool.query(
    `WITH local AS (
       SELECT date_trunc($2::text, now() AT TIME ZONE 'Asia/Kolkata') AS cur_start,
              now() AT TIME ZONE 'Asia/Kolkata' AS cur_now
     ), bounds AS (
       SELECT cur_start AT TIME ZONE 'Asia/Kolkata' AS cur_start_tz,
              cur_now AT TIME ZONE 'Asia/Kolkata' AS cur_now_tz,
              (cur_start - $3::interval) AT TIME ZONE 'Asia/Kolkata' AS prev_start_tz,
              LEAST(cur_start, (cur_start - $3::interval) + (cur_now - cur_start))
                AT TIME ZONE 'Asia/Kolkata' AS prev_end_tz
         FROM local
     )
     SELECT
       COALESCE((SELECT SUM(s.total_amount) FROM sales s
                  WHERE s.business_id = $1 AND s.status = 'COMPLETED'
                    AND s.sale_date >= b.cur_start_tz AND s.sale_date <= b.cur_now_tz), 0)
         AS current_revenue,
       COALESCE((SELECT SUM(s.total_amount) FROM sales s
                  WHERE s.business_id = $1 AND s.status = 'COMPLETED'
                    AND s.sale_date >= b.prev_start_tz AND s.sale_date < b.prev_end_tz), 0)
         AS previous_revenue
       FROM bounds b`,
    [businessId, truncate, back]
  );
  return {
    current: Number(rows[0].current_revenue),
    previous: Number(rows[0].previous_revenue),
  };
}

// What the activity list shows for each kind of audit row.
const ACTIVITY_TYPES = {
  PRODUCT_CREATED: () => ({ type: "product_added", title: "Product added" }),
  STOCK_ADDED: () => ({ type: "stock_added", title: "Stock updated" }),
  STOCK_REMOVED: () => ({ type: "stock_removed", title: "Stock updated" }),
  BILL_CONFIRMED: (row) => ({
    type: "bill_generated",
    title: row.entity_type === "PURCHASE" ? "Purchase recorded" : "Sale recorded",
  }),
  SALE_VOIDED: () => ({ type: "sale_voided", title: "Sale voided" }),
};

export async function listRecentActivity(businessId, limit) {
  const { rows } = await pool.query(
    `SELECT audit_id, action_type, entity_type, description, created_at
       FROM audit_logs
      WHERE business_id = $1 AND action_type = ANY($2::text[])
      ORDER BY created_at DESC, audit_id DESC
      LIMIT $3`,
    [businessId, Object.keys(ACTIVITY_TYPES), limit]
  );
  return rows.map((row) => ({
    id: row.audit_id,
    ...ACTIVITY_TYPES[row.action_type](row),
    detail: row.description ?? "",
    createdAt: row.created_at,
  }));
}

// The signed-in owner and their shop, for the greeting and the profile menu.
export async function getProfile(userId, businessId) {
  const { rows } = await pool.query(
    `SELECT u.first_name, u.last_name, u.email, b.business_name
       FROM app_users u
       JOIN businesses b ON b.owner_user_id = u.user_id
      WHERE u.user_id = $1 AND b.business_id = $2`,
    [userId, businessId]
  );
  if (rows.length === 0) return null;
  return {
    firstName: rows[0].first_name,
    lastName: rows[0].last_name,
    email: rows[0].email,
    businessName: rows[0].business_name,
  };
}
