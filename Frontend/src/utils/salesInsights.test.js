import assert from 'node:assert/strict'
import test from 'node:test'
import { getTopCategorySales } from './salesInsights.js'

const categories = [
  { category: 'A', revenue: 600, unitsSold: 1 },
  { category: 'B', revenue: 500, unitsSold: 2 },
  { category: 'C', revenue: 400, unitsSold: 3 },
  { category: 'D', revenue: 300, unitsSold: 4 },
  { category: 'E', revenue: 200, unitsSold: 5 },
  { category: 'F', revenue: 100, unitsSold: 6 },
  { category: 'G', revenue: 50, unitsSold: 7 },
  { category: 'Others', revenue: 25, unitsSold: 8 },
]

test('keeps the top five categories and combines all remaining values into Others', () => {
  assert.deepEqual(getTopCategorySales(categories, 'revenue'), [
    { category: 'A', revenue: 600, unitsSold: 1 },
    { category: 'B', revenue: 500, unitsSold: 2 },
    { category: 'C', revenue: 400, unitsSold: 3 },
    { category: 'D', revenue: 300, unitsSold: 4 },
    { category: 'E', revenue: 200, unitsSold: 5 },
    { category: 'Others', revenue: 175, unitsSold: 21 },
  ])
})

test('chooses the top five by the selected metric and combines the rest', () => {
  const result = getTopCategorySales(categories, 'unitsSold')
  assert.deepEqual(result.slice(0, 5).map((category) => category.category), [
    'G',
    'F',
    'E',
    'D',
    'C',
  ])
  assert.deepEqual(result.at(-1), { category: 'Others', revenue: 1125, unitsSold: 11 })
})
