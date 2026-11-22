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

// The request body for POST /sales or POST /purchases. `source` says how the list was made:
// typed by hand (MANUAL), read from a voice note (VOICE) or from a bill photo (OCR).
export function buildPayload({ mode, lines, idempotencyKey, allowOversell = false, source = 'MANUAL' }) {
  const payload = {
    idempotencyKey,
    source,
    lines: lines.map((line) => ({
      productId: line.productId,
      quantity: toNumber(line.quantity),
      unitPrice: toNumber(line.unitPrice),
    })),
  }
  if (mode === 'sale' && allowOversell) payload.allowOversell = true
  return payload
}

// True while the list is still the single empty line it starts with.
export function isBlankList(lines) {
  return lines.every((line) => !line.productId && !line.quantity && !line.unitPrice)
}

// Turns the draft read from a voice note or a bill photo (POST /bills/extract) into lines for the
// editor. Nothing is guessed: a product the server could not match clearly stays empty, with the
// words it came from and its closest products kept in `hint` so the owner can pick one. A price that
// was spoken or printed is kept (and marked as the owner's own); otherwise the catalog price is used.
// A product can appear once per entry, so a second line for the same product is left unmatched.
export function draftToLines(draft, products, mode, origin) {
  const byId = new Map(products.map((product) => [product.id, product]))
  const used = new Set()

  return draft.lines.map((item) => {
    const matched = item.matchedProductId ? byId.get(item.matchedProductId) : undefined
    const product = matched && !used.has(matched.id) ? matched : undefined
    if (product) used.add(product.id)

    const hasPrice = typeof item.price === 'number'
    const candidates = (item.candidates ?? [])
      .filter((candidate) => byId.has(candidate.productId))
      .map((candidate) => ({ productId: candidate.productId, name: byId.get(candidate.productId).name }))

    return {
      ...emptyLine(),
      productId: product ? product.id : '',
      quantity: item.quantity === null || item.quantity === undefined ? '' : String(item.quantity),
      unitPrice: hasPrice ? String(item.price) : defaultPrice(product, mode),
      priceTouched: hasPrice,
      hint: { origin, text: item.rawText, unit: item.unit ?? null, candidates },
    }
  })
}

// The draft's detected type as an editor mode, or null when the server could not tell.
export function modeFromDraft(draft) {
  if (draft.type === 'SALE') return 'sale'
  if (draft.type === 'PURCHASE') return 'purchase'
  return null
}
