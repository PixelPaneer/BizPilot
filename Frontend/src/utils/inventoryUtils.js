export function getStockStatus(product) {
  if (product.stock <= 0) return 'out'
  if (product.stock <= product.reorderLevel) return 'low'
  return 'in'
}

export function getInventoryStats(products) {
  const stats = { total: products.length, inStock: 0, low: 0, out: 0 }
  products.forEach((p) => {
    const status = getStockStatus(p)
    if (status === 'out') stats.out += 1
    else if (status === 'low') stats.low += 1
    else stats.inStock += 1
  })
  return stats
}

export function toPercent(value, total) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

export function formatCurrency(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN')
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
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
