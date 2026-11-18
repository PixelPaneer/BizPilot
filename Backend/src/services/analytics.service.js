
import pool from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";

// --------------------------------------------------
// DATE RANGE
// --------------------------------------------------

function getDateRange({
  period = "last30",
  startDate,
  endDate,
}) {
  const now = new Date();

  const today = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
  );

  let start;
  let endExclusive;

  if (period === "custom") {
    if (!startDate || !endDate) {
      throw new ApiError(
        400,
        "startDate and endDate are required for custom period"
      );
    }

    start = new Date(`${startDate}T00:00:00.000Z`);

    endExclusive = new Date(
      new Date(`${endDate}T00:00:00.000Z`).getTime() +
        86400000
    );
  } else if (period === "thisMonth") {
    start = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        1
      )
    );

    endExclusive = new Date(
      today.getTime() + 86400000
    );
  } else {
    const days = {
      last7: 7,
      last30: 30,
      last90: 90,
    }[period] ?? 30;

    start = new Date(
      today.getTime() - (days - 1) * 86400000
    );

    endExclusive = new Date(
      today.getTime() + 86400000
    );
  }

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(endExclusive.getTime()) ||
    start >= endExclusive
  ) {
    throw new ApiError(400, "Invalid date range");
  }

  const duration =
    endExclusive.getTime() - start.getTime();

  return {
    start,
    endExclusive,
    previousStart: new Date(
      start.getTime() - duration
    ),
    previousEndExclusive: start,
  };
}

function iso(date) {
  return date.toISOString();
}

// --------------------------------------------------
// SHARED CALENDAR COMPARISON QUERY
// --------------------------------------------------

const GROUPINGS = {
  daily: {
    interval: "1 day",
    label: "day",
  },
  weekly: {
    interval: "1 week",
    label: "week",
  },
  monthly: {
    interval: "1 month",
    label: "month",
  },
};


async function getComparisonSeries(businessId, range, group) {
  const config = GROUPINGS[group];

  if (!config) {
    throw new ApiError(400, "Invalid grouping");
  }

  const { rows } = await pool.query(
    `WITH current_calendar AS (
       SELECT bucket
       FROM generate_series(
         date_trunc(
           $4,
           $2::timestamptz AT TIME ZONE 'UTC'
         ),
         date_trunc(
           $4,
           ($3::timestamptz - interval '1 microsecond')
             AT TIME ZONE 'UTC'
         ),
         $5::interval
       ) AS bucket
     ),

     current_totals AS (
       SELECT
         date_trunc(
           $4,
           s.sale_date AT TIME ZONE 'UTC'
         ) AS bucket,
         SUM(si.revenue) AS revenue
       FROM sales s
       JOIN sale_items si
         ON si.sale_id = s.sale_id
        AND si.business_id = s.business_id
       WHERE s.business_id = $1
         AND s.status = 'COMPLETED'
         AND s.sale_date >= $2
         AND s.sale_date < $3
       GROUP BY 1
     ),

     previous_totals AS (
       SELECT
         date_trunc(
           $4,
           s.sale_date AT TIME ZONE 'UTC'
         ) AS bucket,
         SUM(si.revenue) AS revenue
       FROM sales s
       JOIN sale_items si
         ON si.sale_id = s.sale_id
        AND si.business_id = s.business_id
       WHERE s.business_id = $1
         AND s.status = 'COMPLETED'
         AND s.sale_date >= $6
         AND s.sale_date < $2
       GROUP BY 1
     )

     SELECT
       c.bucket AT TIME ZONE 'UTC' AS bucket,

       COALESCE(ct.revenue, 0)::numeric(14,2)
         AS current_revenue,

       COALESCE(pt.revenue, 0)::numeric(14,2)
         AS previous_revenue

     FROM current_calendar c

     LEFT JOIN current_totals ct
       ON ct.bucket = c.bucket

     LEFT JOIN previous_totals pt
       ON pt.bucket = c.bucket

     ORDER BY c.bucket`,
    [
      businessId,
      iso(range.start),
      iso(range.endExclusive),
      config.label,
      config.interval,
      iso(range.previousStart),
    ]
  );

  return rows.map((row) => {
    const date = new Date(row.bucket);

    const period =
      group === "monthly"
        ? date.toLocaleDateString("en-IN", {
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })
        : group === "weekly"
          ? `Week of ${date.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              timeZone: "UTC",
            })}`
          : date.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              timeZone: "UTC",
            });

    return {
      period,
      currentRevenue: Number(row.current_revenue),
      previousRevenue: Number(row.previous_revenue),
    };
  });
}


// --------------------------------------------------
// CATEGORY SALES
// --------------------------------------------------


export async function getCategorySales(
  businessId,
  filters
) {
  const range = getDateRange(filters);

  const { rows } = await pool.query(
    `SELECT
       si.category_snapshot AS category,

       COALESCE(
         SUM(si.revenue),
         0
       )::numeric(14,2) AS revenue,

       COALESCE(
         SUM(si.quantity),
         0
       )::numeric(14,3) AS units_sold,

       CASE
         WHEN SUM(SUM(si.revenue)) OVER () = 0
           THEN 0
         ELSE ROUND(
           100.0 * SUM(si.revenue)
           / SUM(SUM(si.revenue)) OVER (),
           2
         )
       END AS revenue_percentage,

       CASE
         WHEN SUM(SUM(si.quantity)) OVER () = 0
           THEN 0
         ELSE ROUND(
           100.0 * SUM(si.quantity)
           / SUM(SUM(si.quantity)) OVER (),
           2
         )
       END AS units_percentage

     FROM sale_items si

     JOIN sales s
       ON s.sale_id = si.sale_id
      AND s.business_id = si.business_id

     WHERE s.business_id = $1
       AND s.status = 'COMPLETED'
       AND s.sale_date >= $2
       AND s.sale_date < $3

     GROUP BY si.category_snapshot

     ORDER BY
       SUM(si.revenue) DESC,
       si.category_snapshot ASC`,
    [
      businessId,
      iso(range.start),
      iso(range.endExclusive),
    ]
  );

  return {
    period: filters.period || "last30",

    categories: rows.map((row) => ({
      category: row.category,
      revenue: Number(row.revenue),
      unitsSold: Number(row.units_sold),
      revenuePercentage: Number(row.revenue_percentage),
      unitsPercentage: Number(row.units_percentage),
    })),
  };
}


// --------------------------------------------------
// SALES TREND
// --------------------------------------------------

export async function getSalesTrend(
  businessId,
  filters
) {
  const range = getDateRange(filters);

  const result = {};

  for (const group of Object.keys(GROUPINGS)) {
    const rows = await getComparisonSeries(
      businessId,
      range,
      group
    );

    result[group] = rows.map((row) => ({
      period: row.period,
      currentPeriodSales: row.currentRevenue,
      previousPeriodSales: row.previousRevenue,
    }));
  }

  return result;
}

// --------------------------------------------------
// TOP SELLING PRODUCTS
// --------------------------------------------------

export async function getTopProducts(
  businessId,
  filters
) {
  const range = getDateRange(filters);

  const limit = Number(filters.limit ?? 14);

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ApiError(400, "limit must be between 1 and 50");
  }
  const { rows } = await pool.query(
    `SELECT
       si.product_id,
       si.product_name_snapshot AS product_name,
       si.category_snapshot AS category,

       SUM(si.quantity)::numeric(14,3)
         AS units_sold,

       SUM(si.revenue)::numeric(14,2)
         AS revenue

     FROM sale_items si

     JOIN sales s
       ON s.sale_id = si.sale_id
      AND s.business_id = si.business_id

     WHERE s.business_id = $1
       AND s.status = 'COMPLETED'
       AND s.sale_date >= $2
       AND s.sale_date < $3

     GROUP BY
       si.product_id,
       si.product_name_snapshot,
       si.category_snapshot

     ORDER BY
       SUM(si.revenue) DESC,
       SUM(si.quantity) DESC

     LIMIT $4`,
    [
      businessId,
      iso(range.start),
      iso(range.endExclusive),
      limit,
    ]
  );

  return {
    products: rows.map((row) => ({
      productName: row.product_name,
      category: row.category,
      unitsSold: Number(row.units_sold),
      revenue: Number(row.revenue),
    })),
  };
}

// --------------------------------------------------
// REVENUE ANALYSIS
// --------------------------------------------------

export async function getRevenueAnalysis(
  businessId,
  filters
) {
  const range = getDateRange(filters);

  const result = {};

  for (const group of Object.keys(GROUPINGS)) {
    const rows = await getComparisonSeries(
      businessId,
      range,
      group
    );

    result[group] = rows.map((row) => ({
      period: row.period,
      selectedPeriodRevenue: row.currentRevenue,
      previousPeriodRevenue: row.previousRevenue,
    }));
  }

  return result;
}
