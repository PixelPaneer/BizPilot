
import assert from 'node:assert/strict'

import {
  getCategorySales,
  getSalesTrend,
  getTopProducts,
  getRevenueAnalysis,
} from '../src/services/analytics.service.js'

const BUSINESS_ID = 'ced5c1db-c94c-4d39-a458-36e17f57e53d'

const options = { period: 'last30' }

const categoryResult = await getCategorySales(BUSINESS_ID, options)
const trendResult = await getSalesTrend(BUSINESS_ID, options)
const productsResult = await getTopProducts(BUSINESS_ID, options)
const revenueResult = await getRevenueAnalysis(BUSINESS_ID, options)

// Category sales
assert.equal(categoryResult.categories.length, 3)

const categoryTotal = categoryResult.categories.reduce(
  (sum, item) => sum + item.revenue,
  0
)

assert.equal(categoryTotal, 11100)

// Sales trend
assert.equal(
  trendResult.daily.reduce((sum, item) => sum + item.currentPeriodSales, 0),
  11100
)

// Top products
assert.equal(productsResult.products.length, 4)
assert.equal(productsResult.products[0].productName, 'Wireless Mouse')
assert.equal(productsResult.products[0].revenue, 5600)

// Revenue analysis
assert.equal(
  revenueResult.daily.reduce((sum, item) => sum + item.selectedPeriodRevenue, 0),
  11100
)

console.log('✅ All analytics assertions passed!')
