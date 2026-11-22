import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPayload,
  defaultPrice,
  placeLine,
  emptyLine,
  entryTotal,
  isBlankList,
  lineTotal,
  oversoldLines,
  splitDraft,
  validateLines,
} from './stockEntry.js'

const parle = { id: 'p1', name: 'Parle-G', price: 10, costPrice: 8, quantity: 50, unit: 'packet' }
const maggi = { id: 'p2', name: 'Maggi', price: 14, costPrice: null, quantity: 3, unit: 'piece' }
const byId = new Map([parle, maggi].map((product) => [product.id, product]))

function line(productId, quantity, unitPrice) {
  return { ...emptyLine(), productId, quantity, unitPrice }
}

test('line totals are exact and round half up like the server', () => {
  assert.equal(lineTotal('5', '10'), 50)
  assert.equal(lineTotal('3', '33.33'), 99.99)
  assert.equal(lineTotal('0.5', '0.01'), 0.01) // 0.005 rounds up
  assert.equal(lineTotal('1.005', '100'), 100.5)
  assert.equal(lineTotal('', '10'), 0)
  assert.equal(lineTotal('abc', '10'), 0)
})

test('the entry total adds up the lines without floating point drift', () => {
  const lines = [line('p1', '3', '0.1'), line('p2', '3', '0.2')]
  assert.equal(entryTotal(lines), 0.9)
  assert.equal(entryTotal([]), 0)
})

test('a picked product starts with the right price for a sale or a purchase', () => {
  assert.equal(defaultPrice(parle, 'sale'), '10')
  assert.equal(defaultPrice(parle, 'purchase'), '8')
  assert.equal(defaultPrice(maggi, 'purchase'), '14', 'falls back to the selling price')
  assert.equal(defaultPrice(undefined, 'sale'), '')
})

test('valid lines pass and every problem is reported on its own line', () => {
  const good = line('p1', '5', '10')
  assert.equal(validateLines([good], byId).isValid, true)

  const cases = [
    [line('', '5', '10'), 'product'],
    [line('nope', '5', '10'), 'product'],
    [line('p1', '', '10'), 'quantity'],
    [line('p1', '0', '10'), 'quantity'],
    [line('p1', '-2', '10'), 'quantity'],
    [line('p1', '1.2345', '10'), 'quantity'],
    [line('p1', 'x', '10'), 'quantity'],
    [line('p1', '5', ''), 'unitPrice'],
    [line('p1', '5', '-1'), 'unitPrice'],
    [line('p1', '5', '9.999'), 'unitPrice'],
  ]
  for (const [badLine, field] of cases) {
    const result = validateLines([badLine], byId)
    assert.equal(result.isValid, false)
    assert.ok(result.errors[badLine.id][field], `expected a ${field} error`)
  }

  assert.equal(validateLines([], byId).isValid, false, 'an empty draft is not valid')
})

test('the same product twice is flagged on the second line only', () => {
  const first = line('p1', '1', '10')
  const second = line('p1', '2', '10')
  const result = validateLines([first, second], byId)
  assert.equal(result.isValid, false)
  assert.equal(result.errors[first.id], undefined)
  assert.ok(result.errors[second.id].product)
})

test('a price of 0 is allowed (a free item)', () => {
  assert.equal(validateLines([line('p1', '1', '0')], byId).isValid, true)
})

test('oversold lines are the ones asking for more than the recorded stock', () => {
  const lines = [line('p1', '50', '10'), line('p2', '4', '14'), line('p2', '3', '14')]
  assert.deepEqual(
    oversoldLines(lines, byId).map((item) => [item.productId, item.quantity]),
    [['p2', '4']],
  )
})

test('the payload uses numbers and only a sale can allow overselling', () => {
  const lines = [line('p1', '5', '10.5')]
  const sale = buildPayload({ mode: 'sale', lines, idempotencyKey: 'key-12345678' })
  assert.deepEqual(sale, {
    idempotencyKey: 'key-12345678',
    source: 'MANUAL',
    lines: [{ productId: 'p1', quantity: 5, unitPrice: 10.5 }],
  })
  assert.equal(
    buildPayload({ mode: 'sale', lines, idempotencyKey: 'k', allowOversell: true }).allowOversell,
    true,
  )
  assert.equal(
    Object.hasOwn(
      buildPayload({ mode: 'purchase', lines, idempotencyKey: 'k', allowOversell: true }),
      'allowOversell',
    ),
    false,
  )
})

const products = [parle, maggi]
const draftLine = (overrides) => ({
  type: 'SALE',
  rawText: 'text',
  quantity: 5,
  unit: null,
  price: null,
  matchedProductId: null,
  matchedProductName: null,
  confidence: 0,
  candidates: [],
  ...overrides,
})
const draft = (lines, type = null) => ({ type, lines, warnings: [] })

test('a matched draft line fills the product, quantity and the catalog price of its kind', () => {
  const result = splitDraft(
    draft([draftLine({ type: 'PURCHASE', matchedProductId: 'p1', quantity: 50 })]),
    products,
    'voice',
  )
  const [first] = result.purchase
  assert.equal(first.productId, 'p1')
  assert.equal(first.quantity, '50')
  assert.equal(first.unitPrice, '8') // the buying price for a purchase
  assert.equal(first.priceTouched, false)
  assert.equal(first.hint.origin, 'voice')
  assert.equal(result.sale.length + result.unsure.length, 0)
})

test('one note with sales and purchases fills both lists', () => {
  const result = splitDraft(
    draft([
      draftLine({ type: 'SALE', matchedProductId: 'p2', quantity: 5 }),
      draftLine({ type: 'PURCHASE', matchedProductId: 'p1', quantity: 50 }),
    ]),
    products,
    'voice',
  )
  assert.deepEqual(
    result.sale.map((line) => [line.productId, line.quantity, line.unitPrice]),
    [['p2', '5', '14']],
  )
  assert.deepEqual(
    result.purchase.map((line) => [line.productId, line.quantity, line.unitPrice]),
    [['p1', '50', '8']],
  )
  assert.equal(result.unsure.length, 0)
})

test('a line without its own kind takes the note’s kind, and with neither it waits for the owner', () => {
  const result = splitDraft(
    draft([draftLine({ type: null, matchedProductId: 'p1' })], 'PURCHASE'),
    products,
    'photo',
  )
  assert.equal(result.purchase.length, 1)

  const unsure = splitDraft(draft([draftLine({ type: null, matchedProductId: 'p1' })]), products, 'voice')
  assert.equal(unsure.unsure.length, 1)
  assert.equal(unsure.unsure[0].unitPrice, '', 'no catalog price until the owner picks Sale or Purchase')
  assert.equal(unsure.sale.length + unsure.purchase.length, 0)
})

test('a spoken or printed price is kept and counts as the owner’s own', () => {
  const result = splitDraft(draft([draftLine({ matchedProductId: 'p1', price: 12 })]), products, 'photo')
  assert.equal(result.sale[0].unitPrice, '12')
  assert.equal(result.sale[0].priceTouched, true)
})

test('an unmatched draft line stays empty and keeps its words and closest products', () => {
  const result = splitDraft(
    draft([
      draftLine({
        rawText: 'Parle-G Biscuit',
        quantity: null,
        candidates: [
          { productId: 'p1', name: 'Parle-G', price: 10 },
          { productId: 'gone', name: 'Deleted product', price: 1 },
        ],
      }),
    ]),
    products,
    'photo',
  )
  const [first] = result.sale
  assert.equal(first.productId, '')
  assert.equal(first.quantity, '', 'a missing quantity is never made up')
  assert.equal(first.unitPrice, '')
  assert.deepEqual(first.hint.candidates, [{ productId: 'p1', name: 'Parle-G' }])
  assert.equal(first.hint.text, 'Parle-G Biscuit')
})

test('a product matched twice in one list is used once; the same product may be in both lists', () => {
  const twice = splitDraft(
    draft([draftLine({ matchedProductId: 'p1' }), draftLine({ matchedProductId: 'p1' })]),
    products,
    'voice',
  )
  assert.deepEqual(twice.sale.map((line) => line.productId), ['p1', ''])

  const both = splitDraft(
    draft([
      draftLine({ type: 'SALE', matchedProductId: 'p1' }),
      draftLine({ type: 'PURCHASE', matchedProductId: 'p1' }),
    ]),
    products,
    'voice',
  )
  assert.equal(both.sale[0].productId, 'p1')
  assert.equal(both.purchase[0].productId, 'p1')
})

test('a matched product that is not in the owner’s list is ignored', () => {
  const result = splitDraft(draft([draftLine({ matchedProductId: 'unknown' })]), products, 'voice')
  assert.equal(result.sale[0].productId, '')
})

test('placing a line of unknown kind gives it that list’s catalog price, unless it has its own', () => {
  const plain = { ...emptyLine(), productId: 'p1', unitPrice: '', priceTouched: false }
  assert.equal(placeLine(plain, parle, 'sale').unitPrice, '10')
  assert.equal(placeLine(plain, parle, 'purchase').unitPrice, '8')
  const spoken = { ...plain, unitPrice: '12', priceTouched: true }
  assert.equal(placeLine(spoken, parle, 'purchase').unitPrice, '12')
})

test('only an untouched list counts as blank', () => {
  assert.equal(isBlankList([emptyLine()]), true)
  assert.equal(isBlankList([line('p1', '', '')]), false)
  assert.equal(isBlankList([emptyLine(), line('', '3', '')]), false)
})

test('the source says how the list was made', () => {
  const lines = [line('p1', '2', '10')]
  assert.equal(buildPayload({ mode: 'sale', lines, idempotencyKey: 'k' }).source, 'MANUAL')
  assert.equal(buildPayload({ mode: 'sale', lines, idempotencyKey: 'k', source: 'VOICE' }).source, 'VOICE')
  assert.equal(buildPayload({ mode: 'purchase', lines, idempotencyKey: 'k', source: 'OCR' }).source, 'OCR')
})
