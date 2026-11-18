
import pool from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";

const TIME_ZONE = "Asia/Kolkata";
const DAY_MS = 24 * 60 * 60 * 1000;

// --------------------------------------------------
// IST DATE HELPERS
// --------------------------------------------------

function getTodayISTDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day + days)
  );

  return date.toISOString().slice(0, 10);
}

function isValidDateOnly(value) {
  if (typeof value !== "string") return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return date.toISOString().slice(0, 10) === value;
}

// Converts IST midnight into the corresponding UTC instant.
// Example: 2026-11-18 00:00 IST = 2026-11-17 18:30 UTC.
function istMidnightToUTC(dateString) {
  if (!isValidDateOnly(dateString)) {
    throw new ApiError(400, "Invalid date");
  }

  const [year, month, day] = dateString.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day) - 330 * 60 * 1000
  );
}

function iso(date) {
  return date.toISOString();
}

// --------------------------------------------------
// DATE RANGE
// --------------------------------------------------

function getDateRange({
  period = "last30",
  startDate,
  endDate,
} = {}) {
  const today = getTodayISTDate();

  let startDateIST;
  let endDateExclusiveIST;

  if (period === "custom") {
    if (
      !isValidDateOnly(startDate) ||
      !isValidDateOnly(endDate)
    ) {
      throw new ApiError(
        400,
        "Valid startDate and endDate are required for custom period"
      );
    }

    if (startDate > endDate) {
      throw new ApiError(
        400,
        "startDate cannot be after endDate"
      );
    }

    startDateIST = startDate;
    endDateExclusiveIST = addCalendarDays(endDate, 1);
  } else if (period === "thisMonth") {
    startDateIST = `${today.slice(0, 7)}-01`;
    endDateExclusiveIST = addCalendarDays(today, 1);
  } else {
    const days = {
      last7: 7,
      last30: 30,
      last90: 90,
    }[period];

    if (!days) {
      throw new ApiError(400, "Invalid analytics period");
    }

    startDateIST = addCalendarDays(today, -(days - 1));
    endDateExclusiveIST = addCalendarDays(today, 1);
  }

  const start = istMidnightToUTC(startDateIST);
  const endExclusive = istMidnightToUTC(endDateExclusiveIST);

  const duration = endExclusive.getTime() - start.getTime();

  return {
    start,
    endExclusive,
    previousStart: new Date(start.getTime() - duration),
    previousEndExclusive: start,
  };
}

// --------------------------------------------------
// GROUPINGS
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

// --------------------------------------------------
// PERIOD LABEL
// --------------------------------------------------

function formatPeriodLabel(bucketDate, group) {
  const [year, month, day] = bucketDate.split("-").map(Number);

  // The date is already an IST calendar date.
  // UTC is used here only to format its date components
  // without introducing another timezone conversion.
  const date = new Date(Date.UTC(year, month - 1, day));

  if (group === "monthly") {
    return date.toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  if (group === "weekly") {
    return `Week of ${date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })}`;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// --------------------------------------------------
// SHARED COMPARISON QUERY
// --------------------------------------------------

async function getComparisonSeries(businessId, range, group) {
  const config = GROUPINGS[group];

  if (!config) {
    throw new ApiError(400, "Invalid grouping");
  }

  const { rows } = await pool.query(
    `WITH current_calendar AS (
       SELECT
         bucket,
         ROW_NUMBER() OVER (ORDER BY bucket) AS bucket_no
       FROM generate_series(
         date_trunc(
           $4,
           $2::timestamptz AT TIME ZONE 'Asia/Kolkata'
         ),
         date_trunc(
           $4,
           ($3::timestamptz - interval '1 microsecond')
             AT TIME ZONE 'Asia/Kolkata'
         ),
         $5::interval
       ) AS gs(bucket)
     ),

     previous_calendar AS (
       SELECT
         bucket,
         ROW_NUMBER() OVER (ORDER BY bucket) AS bucket_no
       FROM generate_series(
         date_trunc(
           $4,
           $6::timestamptz AT TIME ZONE 'Asia/Kolkata'
         ),
         date_trunc(
           $4,
           ($2::timestamptz - interval '1 microsecond')
             AT TIME ZONE 'Asia/Kolkata'
         ),
         $5::interval
       ) AS gs(bucket)
     ),

     current_totals AS (
       SELECT
         date_trunc(
           $4,
           s.sale_date AT TIME ZONE 'Asia/Kolkata'
         ) AS bucket,
         SUM(si.revenue) AS revenue

       FROM sales s

       INNER JOIN sale_items si
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
           s.sale_date AT TIME ZONE 'Asia/Kolkata'
         ) AS bucket,
         SUM(si.revenue) AS revenue

       FROM sales s

       INNER JOIN sale_items si
         ON si.sale_id = s.sale_id
        AND si.business_id = s.business_id

       WHERE s.business_id = $1
         AND s.status = 'COMPLETED'
         AND s.sale_date >= $6
         AND s.sale_date < $2

       GROUP BY 1
     )

     SELECT
       TO_CHAR(c.bucket, 'YYYY-MM-DD') AS bucket_date,

       COALESCE(
         ct.revenue,
         0
       )::numeric(14,2) AS current_revenue,

       COALESCE(
         pt.revenue,
         0
       )::numeric(14,2) AS previous_revenue

     FROM current_calendar c

     LEFT JOIN current_totals ct
       ON ct.bucket = c.bucket

     LEFT JOIN previous_calendar pc
       ON pc.bucket_no = c.bucket_no

     LEFT JOIN previous_totals pt
       ON pt.bucket = pc.bucket

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

  return rows.map((row) => ({
    period: formatPeriodLabel(row.bucket_date, group),
    currentRevenue: Number(row.current_revenue),
    previousRevenue: Number(row.previous_revenue),
  }));
}

// --------------------------------------------------
// CATEGORY SALES
// --------------------------------------------------

export async function getCategorySales(businessId, filters = {}) {
  const range = getDateRange(filters);

  const { rows } = await pool.query(
    `SELECT
       COALESCE(
         NULLIF(TRIM(si.category_snapshot), ''),
         'Uncategorized'
       ) AS category,

       COALESCE(
         SUM(si.revenue),
         0
       )::numeric(14,2) AS revenue,

       COALESCE(
         SUM(si.quantity),
         0
       )::numeric(14,3) AS units_sold,

       CASE
         WHEN SUM(SUM(si.revenue)) OVER () = 0 THEN 0
         ELSE ROUND(
           100.0 * SUM(si.revenue)
           / SUM(SUM(si.revenue)) OVER (),
           2
         )
       END AS revenue_percentage,

       CASE
         WHEN SUM(SUM(si.quantity)) OVER () = 0 THEN 0
         ELSE ROUND(
           100.0 * SUM(si.quantity)
           / SUM(SUM(si.quantity)) OVER (),
           2
         )
       END AS units_percentage

     FROM sale_items si

     INNER JOIN sales s
       ON s.sale_id = si.sale_id
      AND s.business_id = si.business_id

     WHERE s.business_id = $1
       AND s.status = 'COMPLETED'
       AND s.sale_date >= $2
       AND s.sale_date < $3

     GROUP BY
       COALESCE(
         NULLIF(TRIM(si.category_snapshot), ''),
         'Uncategorized'
       )

     ORDER BY SUM(si.revenue) DESC`,
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

export async function getSalesTrend(businessId, filters = {}) {
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

export async function getTopProducts(businessId, filters = {}) {
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

       SUM(si.quantity)::numeric(14,3) AS units_sold,
       SUM(si.revenue)::numeric(14,2) AS revenue

     FROM sale_items si

     INNER JOIN sales s
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
      productId: row.product_id,
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

export async function getRevenueAnalysis(businessId, filters = {}) {
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
