import { useState } from 'react'
import { apiRequest } from './apiClient'
import {
  MAX_LINES,
  MODES,
  buildPayload,
  defaultPrice,
  emptyLine,
  isBlankList,
  newId,
  validateLines,
} from './stockEntry'

function describeError(error) {
  if (error?.code === 'NOT_FOUND') {
    return 'One of these products no longer exists. Refresh the page and try again.'
  }
  if (error?.code === 'VALIDATION_ERROR') return 'Please check the quantities and prices.'
  return error?.message || 'Something went wrong. Please try again.'
}

// Everything one list on the Update Stock page needs: its lines, the checks, saving it as one sale
// (mode 'sale') or one purchase (mode 'purchase'), and undoing a sale. The page uses two of these, one
// for Sales and one for Purchases, so a note that mixes both can fill both lists at once.
// Nothing is saved until `submit` (the owner's Confirm).
export function useEntrySection({ mode, products, onRefresh }) {
  const [lines, setLines] = useState(() => [emptyLine()])
  // Sent with the request so a double click or a retry cannot record the same entry twice. It changes
  // whenever the draft changes, because the server returns the *first* result for a key.
  const [idempotencyKey, setIdempotencyKey] = useState(newId)
  const [phase, setPhase] = useState('editing') // 'editing' | 'saving' | 'done'
  const [showErrors, setShowErrors] = useState(false)
  const [formError, setFormError] = useState('')
  const [shortages, setShortages] = useState(null)
  const [result, setResult] = useState(null) // the saved sale or purchase
  const [undo, setUndo] = useState(null) // null | { reason, saving, error, voided }
  // How the list was made, sent with the entry: typed (MANUAL), spoken (VOICE) or a bill photo (OCR).
  const [source, setSource] = useState('MANUAL')

  const productsById = new Map(products.map((product) => [product.id, product]))
  const { errors, isValid } = validateLines(lines, productsById)

  function changeDraft(updateLines) {
    setLines(updateLines)
    setIdempotencyKey(newId())
    setFormError('')
    setShortages(null)
  }

  function reset() {
    setLines([emptyLine()])
    setSource('MANUAL')
    setIdempotencyKey(newId())
    setPhase('editing')
    setShowErrors(false)
    setFormError('')
    setShortages(null)
    setResult(null)
    setUndo(null)
  }

  function selectProduct(lineId, productId) {
    const product = productsById.get(productId)
    changeDraft((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line
        // A price that was typed, spoken or printed on the bill stays when the product is chosen.
        const keepPrice = line.priceTouched && line.unitPrice !== ''
        return {
          ...line,
          productId,
          unitPrice: keepPrice ? line.unitPrice : defaultPrice(product, mode),
          priceTouched: keepPrice,
        }
      }),
    )
  }

  function updateField(lineId, field, value) {
    changeDraft((current) =>
      current.map((line) =>
        line.id === lineId
          ? { ...line, [field]: value, priceTouched: line.priceTouched || field === 'unitPrice' }
          : line,
      ),
    )
  }

  function addLine() {
    if (lines.length >= MAX_LINES) return
    changeDraft((current) => [...current, emptyLine()])
  }

  function removeLine(lineId) {
    changeDraft((current) =>
      current.length === 1 ? [emptyLine()] : current.filter((line) => line.id !== lineId),
    )
  }

  // Lines read from a voice note or a bill photo (`origin` is 'voice' or 'photo'), or moved here from
  // the other list (`origin` is null for a line that was typed, which leaves how the list was made as it
  // is). A saved list is started afresh; an empty list is replaced; otherwise the new lines go after the
  // existing ones.
  function addLines(incoming, origin) {
    if (incoming.length === 0) return
    if (origin) setSource(origin === 'voice' ? 'VOICE' : 'OCR')
    setShowErrors(false)
    if (phase === 'done') {
      setPhase('editing')
      setResult(null)
      setUndo(null)
      changeDraft(() => incoming)
      return
    }
    changeDraft((current) =>
      isBlankList(current) ? incoming : [...current, ...incoming].slice(0, MAX_LINES),
    )
  }

  async function submit(allowOversell = false) {
    setShowErrors(true)
    if (!validateLines(lines, productsById).isValid) return

    setPhase('saving')
    setFormError('')
    setShortages(null)
    try {
      const data = await apiRequest(MODES[mode].path, {
        method: 'POST',
        body: buildPayload({ mode, lines, idempotencyKey, allowOversell, source }),
      })
      setResult(data)
      setPhase('done')
      onRefresh().catch((error) => console.error('Unable to refresh products.', error))
    } catch (error) {
      setPhase('editing')
      if (error.code === 'INSUFFICIENT_STOCK') setShortages(error.errors)
      else setFormError(describeError(error))
    }
  }

  async function voidSale() {
    const reason = undo.reason.trim()
    if (reason.length < 3 || reason.length > 200) {
      setUndo({ ...undo, error: 'Give a reason of 3 to 200 characters.' })
      return
    }
    setUndo({ ...undo, saving: true, error: '' })
    try {
      const data = await apiRequest(`/sales/${result.saleId}/void`, {
        method: 'POST',
        body: { reason },
      })
      setUndo({ ...undo, saving: false, error: '', voided: data })
      onRefresh().catch((error) => console.error('Unable to refresh products.', error))
    } catch (error) {
      setUndo({ ...undo, saving: false, error: describeError(error) })
    }
  }

  return {
    mode,
    lines,
    errors,
    isValid,
    phase,
    showErrors,
    formError,
    shortages,
    result,
    undo,
    source,
    productsById,
    setShortages,
    setUndo,
    selectProduct,
    updateField,
    addLine,
    removeLine,
    addLines,
    reset,
    submit,
    voidSale,
  }
}
