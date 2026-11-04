import { defaultCategories, OTHER_CATEGORY } from '../data/products'

// Works out the status of a product from its numbers.
export function getStockStatus(product) {
  if (product.quantity === 0) return 'out-of-stock'
  if (product.quantity <= product.lowStockThreshold) return 'low-stock'
  return 'in-stock'
}

// Counts products: total, in stock, low stock, out of stock.
export function getStockCounts(products) {
  const counts = { total: products.length, inStock: 0, lowStock: 0, outOfStock: 0 }

  products.forEach((product) => {
    const status = getStockStatus(product)
    if (status === 'in-stock') counts.inStock += 1
    if (status === 'low-stock') counts.lowStock += 1
    if (status === 'out-of-stock') counts.outOfStock += 1
  })

  return counts
}

// Applies tab + search + category + price sorting, all together.
export function filterProducts(products, { tab, searchQuery, category, sortOrder }) {
  const query = searchQuery.trim().toLowerCase()

  const result = products.filter((product) => {
    const matchesTab = tab === 'all' || getStockStatus(product) === tab
    const matchesSearch = product.name.toLowerCase().includes(query)
    const matchesCategory = category === 'all' || product.category === category
    return matchesTab && matchesSearch && matchesCategory
  })

  // Sorting uses the real number (product.price), not the "₹60.00/kg" text.
  if (sortOrder === 'low-high') result.sort((a, b) => a.price - b.price)
  if (sortOrder === 'high-low') result.sort((a, b) => b.price - a.price)

  return result
}

// Shows a price like "₹60.00/kg"
export function formatPrice(price, unit) {
  return `₹${price.toFixed(2)}/${unit}`
}

// Progress bar width (0-100). A full bar means stock is at 2x the minimum level.
export function getStockPercent(product) {
  if (product.lowStockThreshold === 0) return product.quantity > 0 ? 100 : 0
  const percent = (product.quantity / (product.lowStockThreshold * 2)) * 100
  return Math.min(100, Math.round(percent))
}

// A simple emoji used as a thumbnail for each category.
const categoryEmoji = {
  Fruits: '🍎',
  Dairy: '🥛',
  Bakery: '🍞',
  Vegetables: '🥬',
  Meat: '🍗',
  Beverages: '🧃',
  Other: '📦',
}

export function getCategoryEmoji(category) {
  return categoryEmoji[category] ?? '📦'
}

// Built-in categories + any custom ones your products use (and "Other" last, if used).
export function getCategoryOptions(products) {
  const custom = []

  products.forEach((product) => {
    const name = product.category
    if (name === OTHER_CATEGORY) return
    if (defaultCategories.includes(name) || custom.includes(name)) return
    custom.push(name)
  })

  custom.sort((a, b) => a.localeCompare(b))

  const usesOther = products.some((product) => product.category === OTHER_CATEGORY)
  return [...defaultCategories, ...custom, ...(usesOther ? [OTHER_CATEGORY] : [])]
}