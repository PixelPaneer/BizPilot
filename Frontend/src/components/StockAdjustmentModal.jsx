import { useEffect, useState } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import StockStatusBadge from './StockStatusBadge'
import { getStockStatus } from '../utils/inventoryUtils'

const inputClasses =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-forest focus:outline-none'

function StockAdjustmentModal({ product, onConfirm, onClose }) {
  const [type, setType] = useState('add') // 'add' or 'remove'
  const [amountText, setAmountText] = useState('')
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // ---- Work out the result and any error message ----
  const trimmed = amountText.trim()
  const isWholeNumber = /^\d+$/.test(trimmed) // digits only: no decimals, no minus
  const amount = isWholeNumber ? Number(trimmed) : null

  let error = ''
  if (trimmed === '') {
    error = 'Enter the quantity to adjust.'
  } else if (!isWholeNumber || amount <= 0) {
    error = 'Enter a positive whole number (1 or more).'
  } else if (type === 'remove' && amount > product.quantity) {
    error = `You can remove at most ${product.quantity} units. That is all that is in stock.`
  }

  const isValid = error === ''
  const newQuantity = isValid
    ? type === 'add'
      ? product.quantity + amount
      : product.quantity - amount
    : null

  const newStatus = isValid
    ? getStockStatus({ quantity: newQuantity, lowStockThreshold: product.lowStockThreshold })
    : null

  function handleSubmit(event) {
    event.preventDefault()

    if (!isValid) {
      setShowError(true)
      return // do not save an invalid adjustment
    }

    onConfirm({ newQuantity, type, amount })
  }

  function chooseType(nextType) {
    setType(nextType)
    setShowError(false)
  }

  const toggleBase =
    'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-title"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="adjust-title" className="text-xl font-semibold text-ink">
            Adjust Stock
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-sage-light hover:text-forest"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Product + current stock */}
        <div className="mt-4 rounded-xl bg-cream p-4">
          <p className="font-medium text-ink">{product.name}</p>
          <p className="mt-1 text-sm text-muted">
            Current stock:{' '}
            <span className="font-semibold text-ink">
              {product.quantity} {product.unit}
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          {/* Add / Remove toggle */}
          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-ink">Adjustment type</legend>
            <div className="flex gap-2 rounded-xl border border-line p-1">
              <button
                type="button"
                aria-pressed={type === 'add'}
                onClick={() => chooseType('add')}
                className={`${toggleBase} ${
                  type === 'add' ? 'bg-forest text-white' : 'text-muted hover:bg-sage-light'
                }`}
              >
                <Plus size={16} aria-hidden="true" />
                Add Stock
              </button>
              <button
                type="button"
                aria-pressed={type === 'remove'}
                onClick={() => chooseType('remove')}
                className={`${toggleBase} ${
                  type === 'remove'
                    ? 'bg-danger-text text-white'
                    : 'text-muted hover:bg-danger-bg'
                }`}
              >
                <Minus size={16} aria-hidden="true" />
                Remove Stock
              </button>
            </div>
          </fieldset>

          {/* Quantity */}
          <div>
            <label htmlFor="adjust-amount" className="mb-1 block text-sm font-medium text-ink">
              Quantity to {type === 'add' ? 'add' : 'remove'}
            </label>
            <input
              id="adjust-amount"
              type="number"
              min="1"
              step="1"
              value={amountText}
              onChange={(event) => {
                setAmountText(event.target.value)
                setShowError(false)
              }}
              placeholder="e.g. 20"
              aria-invalid={showError && !isValid}
              aria-describedby={showError && !isValid ? 'adjust-error' : undefined}
              className={inputClasses}
            />
            {showError && !isValid && (
              <p id="adjust-error" className="mt-1 text-xs text-danger-text">
                {error}
              </p>
            )}
          </div>

          {/* Live preview */}
          <div className="flex items-center justify-between rounded-xl border border-line p-4">
            <div>
              <p className="text-xs text-muted">New stock quantity</p>
              <p className="mt-1 text-2xl font-semibold text-ink">
                {isValid ? `${newQuantity} ${product.unit}` : '—'}
              </p>
            </div>
            {newStatus && <StockStatusBadge status={newStatus} />}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-line px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-deep"
            >
              Confirm Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StockAdjustmentModal