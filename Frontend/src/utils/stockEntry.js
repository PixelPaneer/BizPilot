// Logic for the Update Stock page: the editable draft of a sale or a purchase.
// Kept free of React so it can be tested on its own (see stockEntry.test.js).

export const MAX_LINES = 100

// A sale takes stock out and uses the selling price; a purchase brings stock in and uses the
// price paid to the supplier.
export const MODES = {
  sale: { label: 'Sale (stock out)', priceLabel: 'Selling price (₹)', path: '/sales' },
  purchase: { label: 'Purchase (stock in)', priceLabel: 'Buying price (₹)', path: '/purchases' },
}

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function emptyLine() {
  return { id: newId(), productId: '', quantity: '', unitPrice: '', priceTouched: false }
}

// The price a line starts with when a product is picked (the owner can change it).
export function defaultPrice(product, mode) {
  if (!product) return ''
  const price = mode === 'purchase' ? (product.costPrice ?? product.price) : product.price
  return String(price)
}

function toNumber(text) {
  const trimmed = String(text ?? '').trim()
  return trimmed === '' ? NaN : Number(trimmed)
}

function decimalsOk(value, places) {
  const scaled = value * 10 ** places
  return Math.abs(scaled - Math.round(scaled)) < 1e-8
}

// quantity x price in rupees, calculated in whole paise so there are no floating point errors.
// Same rounding as the server (half up).
export function lineTotal(quantityText, unitPriceText) {
  const quantity = toNumber(quantityText)
  const price = toNumber(unitPriceText)
  if (!Number.isFinite(quantity) || !Number.isFinite(price)) return 0
  const paise = Math.floor((Math.round(quantity * 1000) * Math.round(price * 100) + 500) / 1000)
  return paise / 100
}

export function entryTotal(lines) {
  const paise = lines.reduce(
    (sum, line) => sum + Math.round(lineTotal(line.quantity, line.unitPrice) * 100),
    0,
  )
  return paise / 100
}

// Checks every line. Returns { errors, isValid } where errors is { [lineId]: { product,
// quantity, unitPrice } } holding a message for each field that has a problem.
export function validateLines(lines, productsById) {
  const errors = {}
  const seen = new Map()

  lines.forEach((line) => {
    const lineErrors = {}

    if (!line.productId || !productsById.has(line.productId)) {
      lineErrors.product = 'Choose a product.'
    } else if (seen.has(line.productId)) {
      lineErrors.product = 'This product is already in the list.'
    } else {
      seen.set(line.productId, line.id)
    }

    const quantity = toNumber(line.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      lineErrors.quantity = 'Enter a quantity above 0.'
    } else if (!decimalsOk(quantity, 3)) {
      lineErrors.quantity = 'Use at most 3 decimal places.'
    }

    const price = toNumber(line.unitPrice)
    if (!Number.isFinite(price) || price < 0) {
      lineErrors.unitPrice = 'Enter a price (0 or more).'
    } else if (!decimalsOk(price, 2)) {
      lineErrors.unitPrice = 'Use at most 2 decimal places.'
    }

    if (Object.keys(lineErrors).length > 0) errors[line.id] = lineErrors
  })

  return { errors, isValid: Object.keys(errors).length === 0 && lines.length > 0 }
}

// Lines that ask for more than the recorded stock (only meaningful for a sale).
export function oversoldLines(lines, productsById) {
  return lines.filter((line) => {
    const product = productsById.get(line.productId)
    const quantity = toNumber(line.quantity)
    return product && Number.isFinite(quantity) && quantity > product.quantity
  })
}

// The request body for POST /sales or POST /purchases.
export function buildPayload({ mode, lines, idempotencyKey, allowOversell = false }) {
  const payload = {
    idempotencyKey,
    source: 'MANUAL',
    lines: lines.map((line) => ({
      productId: line.productId,
      quantity: toNumber(line.quantity),
      unitPrice: toNumber(line.unitPrice),
    })),
  }
  if (mode === 'sale' && allowOversell) payload.allowOversell = true
  return payload
}
