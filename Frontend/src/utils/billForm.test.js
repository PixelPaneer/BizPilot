import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBillForm } from './billForm.js'

const photo = new File(['x'], 'bill.jpg', { type: 'image/jpeg' })
const voice = new File(['x'], 'note.webm', { type: 'audio/webm' })

test('a photo is sent in the image field and a voice note in the audio field, never both', () => {
  const imageForm = buildBillForm({ image: photo })
  assert.ok(imageForm.has('image') && !imageForm.has('audio'))

  const audioForm = buildBillForm({ audio: voice })
  assert.ok(audioForm.has('audio') && !audioForm.has('image'))
})

test('the owner’s choice of sale or purchase is sent as the type', () => {
  assert.equal(buildBillForm({ image: photo, type: 'SALE' }).get('type'), 'SALE')
  assert.equal(buildBillForm({ image: photo, type: 'PURCHASE' }).get('type'), 'PURCHASE')
})

test('"let the app decide" and anything else sends no type', () => {
  for (const type of [undefined, null, '', 'auto', 'REFUND']) {
    assert.equal(buildBillForm({ image: photo, type }).has('type'), false, String(type))
  }
})

test('a file without a name still gets one', () => {
  const nameless = new Blob(['x'], { type: 'image/jpeg' })
  assert.equal(buildBillForm({ image: nameless }).get('image').name, 'bill.jpg')
})
