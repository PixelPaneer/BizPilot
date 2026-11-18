import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPayload,
  defaultPrice,
  emptyLine,
  entryTotal,
  lineTotal,
  oversoldLines,
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
