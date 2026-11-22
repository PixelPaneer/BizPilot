import assert from 'node:assert/strict'
import test from 'node:test'
import { fitWithin, pickRecorderType } from './mediaCapture.js'

test('a large picture shrinks so its longest side fits, keeping its shape', () => {
  assert.deepEqual(fitWithin(4000, 3000, 2000), { width: 2000, height: 1500 })
  assert.deepEqual(fitWithin(3000, 4000, 2000), { width: 1500, height: 2000 })
})

test('a picture that is already small is left alone', () => {
  assert.deepEqual(fitWithin(1200, 800, 2000), { width: 1200, height: 800 })
  assert.deepEqual(fitWithin(2000, 2000, 2000), { width: 2000, height: 2000 })
})

test('the first recording format the browser supports is used', () => {
  assert.equal(pickRecorderType((type) => type === 'audio/webm'), 'audio/webm')
  assert.equal(pickRecorderType((type) => type === 'audio/mp4'), 'audio/mp4')
  assert.equal(pickRecorderType((type) => type.startsWith('audio/webm')), 'audio/webm;codecs=opus')
})

test('a browser that supports none gets the default format', () => {
  assert.equal(pickRecorderType(() => false), '')
})
