import { defaultCategories, OTHER_CATEGORY } from '../data/products'

export function getStockStatus(product) {
  if ('quantity' in product) {
    if (product.quantity === 0) return 'out-of-stock'
    if (product.quantity <= product.lowStockThreshold) return 'low-stock'
    return 'in-stock'
  }
  if (product.stock <= 0) return 'out'
  if (product.stock <= product.reorderLevel) return 'low'
  return 'in'
}

export function getInventoryStats(products) {
  const stats = { total: products.length, inStock: 0, low: 0, out: 0 }
  products.forEach((product) => {
    const status = getStockStatus(product)
    if (status === 'out') stats.out += 1
    else if (status === 'low') stats.low += 1
    else stats.inStock += 1
  })
  return stats
}

export function getStockCounts(products) {
  const counts = { total: products.length, inStock: 0, lowStock: 0, outOfStock: 0 }
  products.forEach((product) => {
    const status = getStockStatus(product)
    if (status === 'in-stock' || status === 'in') counts.inStock += 1
    if (status === 'low-stock' || status === 'low') counts.lowStock += 1
    if (status === 'out-of-stock' || status === 'out') counts.outOfStock += 1
  })
  return counts
}

export function toPercent(value, total) {
  return total ? Math.round((value / total) * 100) : 0
}

export function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`
}

export function timeAgo(isoDate) {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const mins = Math.max(1, Math.round(diffMs / 60000))
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function filterProducts(products, { tab, searchQuery, category, sortOrder }) {
  const query = searchQuery.trim().toLowerCase()
  const result = products.filter((product) => {
    const matchesTab = tab === 'all' || getStockStatus(product) === tab
    const matchesSearch = product.name.toLowerCase().includes(query)
    const matchesCategory = category === 'all' || product.category === category
    return matchesTab && matchesSearch && matchesCategory
  })
  if (sortOrder === 'low-high') result.sort((a, b) => a.price - b.price)
  if (sortOrder === 'high-low') result.sort((a, b) => b.price - a.price)
  return result
}

export function formatPrice(price, unit) {
  return `₹${price.toFixed(2)}/${unit}`
}

export function getStockPercent(product) {
  if (product.lowStockThreshold === 0) return product.quantity > 0 ? 100 : 0
  const percent = (product.quantity / (product.lowStockThreshold * 2)) * 100
  return Math.min(100, Math.round(percent))
}

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

export function getCategoryOptions(products) {
  const custom = []
  products.forEach((product) => {
    const name = product.category
    if (name === OTHER_CATEGORY || defaultCategories.includes(name) || custom.includes(name)) return
    custom.push(name)
  })
  custom.sort((a, b) => a.localeCompare(b))
  const usesOther = products.some((product) => product.category === OTHER_CATEGORY)
  return [...defaultCategories, ...custom, ...(usesOther ? [OTHER_CATEGORY] : [])]
}
