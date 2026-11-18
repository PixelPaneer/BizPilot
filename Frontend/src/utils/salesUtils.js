const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})
const numberFormatter = new Intl.NumberFormat('en-IN')

// 124350 -> ₹1,24,350
export const formatINR = (value) => inrFormatter.format(value)
// 124350 -> 1,24,350
export const formatNumber = (value) => numberFormatter.format(value)

// 20000 -> ₹20K, 150000 -> ₹1.5L
export function formatCompactINR(value) {
  if (value >= 10000000) return `₹${+(value / 10000000).toFixed(1)}Cr`
  if (value >= 100000) return `₹${+(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${+(value / 1000).toFixed(1)}K`
  return `₹${value}`
}

export function formatShortDate(date) {
  return `${date.getDate()} ${date.toLocaleString('en-IN', { month: 'short' })}`
}

// Date -> "2026-10-31" (what <input type="date"> needs)
export function toInputDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fromInputDate(value) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const DATE_PRESETS = [
  { value: 'last7', label: 'Last 7 days', days: 7 },
  { value: 'last30', label: 'Last 30 days', days: 30 },
  { value: 'last90', label: 'Last 90 days', days: 90 },
  { value: 'thisMonth', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
]

// Turns the filter choice into real start / end dates
export function resolveDateRange({ preset, customStart, customEnd }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let start = new Date(today)
  let end = new Date(today)

  if (preset === 'thisMonth') {
    start = new Date(today.getFullYear(), today.getMonth(), 1)
  } else if (preset === 'custom' && customStart && customEnd) {
    start = fromInputDate(customStart)
    end = fromInputDate(customEnd)
  } else {
    const found = DATE_PRESETS.find((p) => p.value === preset)
    const days = found?.days ?? 30
    start.setDate(today.getDate() - (days - 1))
  }

  if (end < start) {
    const temp = start
    start = end
    end = temp
  }
  const days = Math.round((end - start) / 86400000) + 1
  return { start, end, days }
}

export function getRangeLabel(range) {
  if (range.preset === 'custom' && range.customStart && range.customEnd) {
    const { start, end } = resolveDateRange(range)
    return `${formatShortDate(start)} – ${formatShortDate(end)}`
  }
  return DATE_PRESETS.find((p) => p.value === range.preset)?.label ?? 'Last 30 days'
}