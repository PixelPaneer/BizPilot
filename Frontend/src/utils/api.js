<<<<<<< origin/Frontend_v2
import { apiRequest } from './apiClient'

// The dashboard's period selector uses week / month / year; the API uses calendar periods.
const API_PERIODS = { week: 'this_week', month: 'this_month', year: 'this_year' }

// Loads the dashboard from the backend: the revenue and stock cards, and the latest activity.
// Throws an ApiRequestError if the server cannot be reached or answers with an error.
export async function fetchDashboard(period = 'month') {
  const [summary, activity] = await Promise.all([
    apiRequest(`/dashboard/summary?period=${API_PERIODS[period] ?? 'this_month'}`),
    apiRequest('/dashboard/activity?limit=5'),
  ])

  return {
    revenue: {
      amount: summary.totalRevenue,
      previous: summary.previousRevenue,
      // null when there were no sales in the previous period to compare with
      changePercent: summary.revenueChangePercent,
    },
    inventory: {
      total: summary.totalProducts,
      inStock: summary.inStockProducts,
      low: summary.lowStockProducts,
      out: summary.outOfStockProducts,
    },
    activities: activity.items,
=======
import products from '../data/products'
import { recentActivities, revenueByPeriod } from '../data/dashboard'
import { getInventoryStats } from './inventoryUtils'

function changePercent(current, previous) {
  if (!previous) return 0
  return Math.round(((current - previous) / previous) * 100)
}

// Same response shape as the server, built from local data.
function buildFallback(period) {
  const rev = revenueByPeriod[period] || revenueByPeriod.month
  return {
    revenue: {
      amount: rev.amount,
      previous: rev.previous,
      changePercent: changePercent(rev.amount, rev.previous),
    },
    inventory: getInventoryStats(products),
    activities: recentActivities.map((a) => ({
      ...a,
      createdAt: new Date(Date.now() - a.minutesAgo * 60000).toISOString(),
    })),
  }
}

// Loads dashboard data from Express + PostgreSQL.
// If the backend isn't running yet, the page still renders using local sample data.
export async function fetchDashboard(period = 'month') {
  try {
    const res = await fetch(`/api/dashboard?period=${period}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.info('[BizPilot] API unavailable, using sample data:', err.message)
    return buildFallback(period)
>>>>>>> origin/frontend-insights-anwesha
  }
}
