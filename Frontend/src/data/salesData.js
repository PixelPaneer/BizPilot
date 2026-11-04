import { formatShortDate } from '../utils/salesUtils'

/* ---------- helpers that make believable sample numbers ---------- */

const DAILY_REVENUE = 4145 // average sales per day (30 days = ₹1,24,350)
const DAILY_UNITS = 41.5 // average units per day

const wave = (i, seed) =>
  Math.sin(i * 1.7 + seed) * 0.08 + Math.cos(i * 0.9 + seed * 2) * 0.05

// small, repeatable shake so different date ranges give different shares
const jitter = (i, seed) => 1 + Math.sin(seed * 1.3 + i * 2.1) * 0.12

function buildSeries(labels, startValue, endValue, seed) {
  const last = Math.max(labels.length - 1, 1)
  return labels.map((period, i) => {
    const base = startValue + ((endValue - startValue) * i) / last
    return {
      period,
      currentPeriodSales: Math.round((base * (1 + wave(i, seed))) / 10) * 10,
      previousPeriodSales: Math.round((base * 0.82 * (1 + wave(i, seed + 3))) / 10) * 10,
    }
  })
}

/* ---------- hourly view (used when the selected range is a single day) ---------- */
const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i) // 8 AM to 9 PM
const HOUR_WEIGHTS = [0.4, 0.6, 0.8, 1.0, 1.2, 1.1, 0.9, 0.8, 0.9, 1.1, 1.4, 1.5, 1.2, 0.8]
const WEIGHT_SUM = HOUR_WEIGHTS.reduce((a, b) => a + b, 0)

const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`

function buildHourlySeries(seed) {
  return HOURS.map((hour, i) => {
    const base = (DAILY_REVENUE * HOUR_WEIGHTS[i]) / WEIGHT_SUM
    return {
      period: hourLabel(hour),
      currentPeriodSales: Math.round((base * (1 + wave(i, seed))) / 10) * 10,
      previousPeriodSales: Math.round((base * 0.85 * (1 + wave(i, seed + 3))) / 10) * 10,
    }
  })
}

function lastNDates(n, stepDays = 1, endDate = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(endDate)
    d.setDate(endDate.getDate() - (n - 1 - i) * stepDays)
    return d
  })
}

function lastNMonthLabels(n, endDate) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(endDate.getFullYear(), endDate.getMonth() - (n - 1 - i), 1)
    return d.toLocaleString('en-IN', { month: 'short' })
  })
}

// Splits a total into parts using weights, and makes sure the parts add up exactly
function splitTotal(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0)
  const parts = weights.map((w) => Math.round((total * w) / sum))
  parts[parts.length - 1] += total - parts.reduce((a, b) => a + b, 0)
  return parts
}

/* ---------- Sales by Category ---------- */
// Revenue shares and unit shares are intentionally different.
const CATEGORY_BASE = [
  { category: 'Bakery', revenueShare: 0.32, unitShare: 0.18 },
  { category: 'Fruits', revenueShare: 0.2, unitShare: 0.22 },
  { category: 'Dairy', revenueShare: 0.18, unitShare: 0.26 },
  { category: 'Snacks', revenueShare: 0.12, unitShare: 0.16 },
  { category: 'Beverages', revenueShare: 0.1, unitShare: 0.1 },
  { category: 'Others', revenueShare: 0.08, unitShare: 0.08 },
]

export function getCategorySales({ days }) {
  const totalRevenue = Math.round(days * DAILY_REVENUE)
  const totalUnits = Math.round(days * DAILY_UNITS)
  const revenues = splitTotal(
    totalRevenue,
    CATEGORY_BASE.map((c, i) => c.revenueShare * jitter(i, days)),
  )
  const units = splitTotal(
    totalUnits,
    CATEGORY_BASE.map((c, i) => c.unitShare * jitter(i + 7, days)),
  )
  return CATEGORY_BASE.map((c, i) => ({
    category: c.category,
    revenue: revenues[i],
    unitsSold: units[i],
  }))
}

/* ---------- Daily / Weekly / Monthly views (shared by both line charts) ---------- */
// Daily follows the selected range (hourly if the range is a single day).
// Weekly and monthly always show enough periods to draw a proper line.
function buildTimeViews({ end, days }, seedOffset) {
  const weeks = Math.max(Math.ceil(days / 7), 4)
  const months = Math.max(Math.ceil(days / 30), 6)

  return {
    daily:
      days === 1
        ? buildHourlySeries(days + seedOffset)
        : buildSeries(
            lastNDates(days, 1, end).map(formatShortDate),
            DAILY_REVENUE * 0.7,
            DAILY_REVENUE * 1.3,
            days + seedOffset,
          ),
    weekly: buildSeries(
      lastNDates(weeks, 7, end).map(formatShortDate),
      DAILY_REVENUE * 7 * 0.7,
      DAILY_REVENUE * 7 * 1.3,
      days + 1 + seedOffset,
    ),
    monthly: buildSeries(
      lastNMonthLabels(months, end),
      DAILY_REVENUE * 30 * 0.7,
      DAILY_REVENUE * 30 * 1.3,
      days + 2 + seedOffset,
    ),
  }
}

/* ---------- Sales Trend ---------- */
export function getSalesTrend(range) {
  return buildTimeViews(range, 0)
}

/* ---------- Revenue Analysis ---------- */
export function getRevenueComparison(range) {
  const views = buildTimeViews(range, 5)
  const rename = (rows) =>
    rows.map((row) => ({
      period: row.period,
      selectedPeriodRevenue: row.currentPeriodSales,
      previousPeriodRevenue: row.previousPeriodSales,
    }))
  return {
    daily: rename(views.daily),
    weekly: rename(views.weekly),
    monthly: rename(views.monthly),
  }
}

/* ---------- Top Selling Products (follows the date filter) ---------- */
const PRODUCT_BASE = [
  { productName: 'Maggi Noodles', category: 'Snacks', unitsPer30Days: 120, price: 30 },
  { productName: 'Amul Milk 1L', category: 'Dairy', unitsPer30Days: 95, price: 30 },
  { productName: 'Lays Chips', category: 'Snacks', unitsPer30Days: 80, price: 30 },
  { productName: 'Bread (Brown)', category: 'Bakery', unitsPer30Days: 65, price: 30 },
  { productName: 'Coca Cola 500ml', category: 'Beverages', unitsPer30Days: 60, price: 30 },
  { productName: 'Parle-G Biscuits', category: 'Snacks', unitsPer30Days: 55, price: 20 },
  { productName: 'Banana (1 dozen)', category: 'Fruits', unitsPer30Days: 40, price: 25 },
  { productName: 'Curd 500g', category: 'Dairy', unitsPer30Days: 38, price: 35 },
  { productName: 'Apple (1 kg)', category: 'Fruits', unitsPer30Days: 34, price: 120 },
  { productName: 'Butter 100g', category: 'Dairy', unitsPer30Days: 30, price: 55 },
  { productName: 'Pav (6 pcs)', category: 'Bakery', unitsPer30Days: 28, price: 25 },
  { productName: 'Orange Juice 1L', category: 'Beverages', unitsPer30Days: 24, price: 110 },
  { productName: 'Detergent 1kg', category: 'Others', unitsPer30Days: 20, price: 130 },
  { productName: 'Cream Biscuits', category: 'Snacks', unitsPer30Days: 18, price: 40 },
]

export function getTopSellingProducts({ days }) {
  return PRODUCT_BASE.map((p, i) => {
    const unitsSold = Math.max(
      1,
      Math.round(((p.unitsPer30Days * days) / 30) * jitter(i + 3, days)),
    )
    return {
      productName: p.productName,
      category: p.category,
      unitsSold,
      revenue: unitsSold * p.price,
    }
  }).sort((a, b) => b.revenue - a.revenue)
}