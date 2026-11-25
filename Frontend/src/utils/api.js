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
  }
}
