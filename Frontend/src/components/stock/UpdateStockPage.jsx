import { useState } from 'react'
import { Camera, Check, Keyboard, Mic, Plus, Trash2, TriangleAlert } from 'lucide-react'
import ProductPicker from './ProductPicker'
import { apiRequest } from '../../utils/apiClient'
import { formatCurrency } from '../../utils/inventoryUtils'
import {
  MAX_LINES,
  MODES,
  buildPayload,
  defaultPrice,
  emptyLine,
  entryTotal,
  lineTotal,
  newId,
  validateLines,
} from '../../utils/stockEntry'

const inputClasses =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-forest focus:outline-none'
const cardClasses = 'rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6'
const primaryButton =
  'rounded-full bg-forest px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-deep disabled:cursor-not-allowed disabled:opacity-60'
const secondaryButton =
  'rounded-full border border-line px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60'

// The ways to fill in the list. Only typing the items works for now; scanning a bill and
// speaking are placeholders until they are built.
const INPUT_METHODS = [
  { key: 'manual', label: 'Type items', hint: 'Add products one by one', icon: Keyboard, available: true },
  { key: 'photo', label: 'Scan a bill', hint: 'Take or upload a photo', icon: Camera, available: false },
  { key: 'voice', label: 'Speak', hint: 'Say what you sold or received', icon: Mic, available: false },
]

function describeError(error) {
  if (error?.code === 'NOT_FOUND') {
    return 'One of these products no longer exists. Refresh the page and try again.'
  }
  if (error?.code === 'VALIDATION_ERROR') return 'Please check the quantities and prices.'
  return error?.message || 'Something went wrong. Please try again.'
}

// Update Stock: build a list of products with quantities and prices, then save it as one sale
// (stock goes down) or one purchase (stock goes up). Nothing is saved until Confirm.
function UpdateStockPage({ products, isLoading, loadError, onRefresh, onNavigate }) {
  const [mode, setMode] = useState('sale')
  const [lines, setLines] = useState(() => [emptyLine()])
  // Sent with the request so a double click or a retry cannot record the same entry twice.
  // It changes whenever the draft changes, because the server returns the *first* result for a key.
  const [idempotencyKey, setIdempotencyKey] = useState(newId)
  const [phase, setPhase] = useState('editing') // 'editing' | 'saving' | 'done'
  const [showErrors, setShowErrors] = useState(false)
  const [formError, setFormError] = useState('')
  const [shortages, setShortages] = useState(null)
  const [result, setResult] = useState(null) // { kind: 'sale' | 'purchase', data }
  const [undo, setUndo] = useState(null) // null | { reason, saving, error, voided }

  const productsById = new Map(products.map((product) => [product.id, product]))
  const { errors } = validateLines(lines, productsById)
  const total = entryTotal(lines)
  const isSaving = phase === 'saving'

  function changeDraft(updateLines) {
    setLines(updateLines)
    setIdempotencyKey(newId())
    setFormError('')
    setShortages(null)
  }

  function changeMode(nextMode) {
    if (nextMode === mode) return
    setMode(nextMode)
    // Prices the owner has not typed themselves follow the new mode.
    changeDraft((current) =>
      current.map((line) => {
        const product = productsById.get(line.productId)
        if (!product || line.priceTouched) return line
        return { ...line, unitPrice: defaultPrice(product, nextMode) }
      }),
    )
  }

  function selectProduct(lineId, productId) {
    const product = productsById.get(productId)
    changeDraft((current) =>
      current.map((line) =>
        line.id === lineId
          ? { ...line, productId, unitPrice: defaultPrice(product, mode), priceTouched: false }
          : line,
      ),
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

  function startAgain() {
    setLines([emptyLine()])
    setIdempotencyKey(newId())
    setPhase('editing')
    setShowErrors(false)
    setFormError('')
    setShortages(null)
    setResult(null)
    setUndo(null)
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
        body: buildPayload({ mode, lines, idempotencyKey, allowOversell }),
      })
      setResult({ kind: mode, data })
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
      const data = await apiRequest(`/sales/${result.data.saleId}/void`, {
        method: 'POST',
        body: { reason },
      })
      setUndo({ ...undo, saving: false, error: '', voided: data })
      onRefresh().catch((error) => console.error('Unable to refresh products.', error))
    } catch (error) {
      setUndo({ ...undo, saving: false, error: describeError(error) })
    }
  }

  if (isLoading) {
    return <p className={`${cardClasses} text-sm text-muted`}>Loading your products...</p>
  }
  if (loadError) {
    return (
      <p className={`${cardClasses} text-sm text-danger-text`}>
        Could not load your products: {loadError}
      </p>
    )
  }
  if (products.length === 0) {
    return (
      <div className={cardClasses}>
        <p className="text-sm text-muted">
          Your inventory is empty. Add products first, then come back to record sales and
          purchases.
        </p>
        <button type="button" onClick={() => onNavigate('inventory')} className={`${primaryButton} mt-4`}>
          Go to inventory
        </button>
      </div>
    )
  }

  // ------------------------------------------------------------------ result screen
  if (phase === 'done' && result) {
    const { kind, data } = result
    const isSale = kind === 'sale'
    const voided = undo?.voided

    return (
      <section aria-label="Entry saved" className={cardClasses}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-light text-deep">
            <Check size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-ink">
              {voided ? 'Sale undone' : isSale ? 'Sale recorded' : 'Purchase recorded'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isSale && <span className="font-medium text-ink">{data.saleNumber}</span>}
              {isSale && ' · '}
              Total {formatCurrency(data.totalAmount)}
              {voided && ' · The stock has been put back.'}
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Product</th>
                <th className="py-2 pr-3 font-medium">Quantity</th>
                <th className="py-2 pr-3 font-medium">Price</th>
                <th className="py-2 font-medium">{voided ? 'Stock restored' : 'New stock'}</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.productId} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 font-medium text-ink">{line.productName}</td>
                  <td className="py-2 pr-3">{line.quantity}</td>
                  <td className="py-2 pr-3">{formatCurrency(line.unitPrice)}</td>
                  <td className="py-2">
                    {voided ? 'Yes' : line.newQuantity}
                    {line.shortfall > 0 && (
                      <span className="ml-2 text-xs text-warn-text">
                        ({line.shortfall} more than the stock on record)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {[...data.warnings, ...(voided?.warnings ?? [])].map((warning) => (
          <p key={warning} className="mt-3 flex items-start gap-2 text-sm text-warn-text">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {warning}
          </p>
        ))}

        {undo && !voided && (
          <div className="mt-5 rounded-xl border border-line bg-cream p-4">
            <label htmlFor="undo-reason" className="block text-sm font-medium text-ink">
              Why are you undoing this sale?
            </label>
            <input
              id="undo-reason"
              type="text"
              maxLength={200}
              value={undo.reason}
              onChange={(event) => setUndo({ ...undo, reason: event.target.value, error: '' })}
              className={`${inputClasses} mt-2 border-line`}
            />
            {undo.error && (
              <p role="alert" className="mt-2 text-sm text-danger-text">
                {undo.error}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={voidSale} disabled={undo.saving} className={primaryButton}>
                {undo.saving ? 'Undoing...' : 'Undo sale'}
              </button>
              <button type="button" onClick={() => setUndo(null)} disabled={undo.saving} className={secondaryButton}>
                Keep sale
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={startAgain} className={primaryButton}>
            Record another
          </button>
          <button type="button" onClick={() => onNavigate('inventory')} className={secondaryButton}>
            Back to inventory
          </button>
          {isSale && !undo && !voided && (
            <button
              type="button"
              onClick={() => setUndo({ reason: 'Entered by mistake', saving: false, error: '', voided: null })}
              className={secondaryButton}
            >
              Undo this sale
            </button>
          )}
        </div>
        {!isSale && (
          <p className="mt-3 text-xs text-muted">
            A purchase cannot be undone here. If it was a mistake, correct the stock from the
            Inventory page.
          </p>
        )}
      </section>
    )
  }

  // ------------------------------------------------------------------ editor
  const usedIds = lines.map((line) => line.productId).filter(Boolean)
  const labelClasses = 'mb-1 block text-xs font-medium text-muted md:sr-only'

  return (
    <section aria-label="Update stock" className={cardClasses}>
      <div role="group" aria-label="How to add items" className="grid gap-2 sm:grid-cols-3">
        {INPUT_METHODS.map(({ key, label, hint, icon: Icon, available }) => (
          <button
            key={key}
            type="button"
            disabled={!available}
            aria-pressed={available ? true : undefined}
            title={available ? undefined : 'Coming soon'}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
              available
                ? 'border-forest bg-sage-light text-deep'
                : 'cursor-not-allowed border-line bg-cream text-muted opacity-75'
            }`}
          >
            <Icon size={20} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted">{hint}</span>
              {!available && (
                <span className="mt-1.5 inline-block rounded-full bg-sage-light px-2 py-0.5 text-[11px] font-medium text-forest">
                  Coming soon
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      <div role="group" aria-label="Type of entry" className="mt-5 flex gap-2 rounded-xl border border-line p-1 sm:inline-flex">
        {Object.entries(MODES).map(([key, option]) => (
          <button
            key={key}
            type="button"
            aria-pressed={mode === key}
            onClick={() => changeMode(key)}
            disabled={isSaving}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
              mode === key ? 'bg-forest text-white' : 'text-muted hover:bg-sage-light'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        {mode === 'sale'
          ? 'Record what you sold. Stock goes down, and the sale shows in your reports. Prices start from your catalog; change them if the customer paid something different.'
          : 'Record stock you received from a supplier. Stock goes up, and the price you enter becomes the product’s buying price.'}
      </p>

      <div className="mt-5 hidden grid-cols-[minmax(0,2fr)_110px_130px_110px_40px] gap-3 text-xs font-medium uppercase tracking-wide text-muted md:grid">
        <span>Product</span>
        <span>Quantity</span>
        <span>{MODES[mode].priceLabel}</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      <div className="mt-2 space-y-4 md:space-y-3">
        {lines.map((line, index) => {
          const product = productsById.get(line.productId)
          const lineError = showErrors ? errors[line.id] : undefined
          const quantity = Number(line.quantity)
          const tooMany = mode === 'sale' && product && quantity > product.quantity

          return (
            <div
              key={line.id}
              className="grid gap-3 rounded-xl border border-line p-3 md:grid-cols-[minmax(0,2fr)_110px_130px_110px_40px] md:items-start md:border-0 md:p-0"
            >
              <div>
                <label htmlFor={`product-${line.id}`} className={labelClasses}>
                  Product
                </label>
                <ProductPicker
                  id={`product-${line.id}`}
                  label={`Product, item ${index + 1}`}
                  products={products}
                  selectedId={line.productId}
                  excludeIds={usedIds.filter((id) => id !== line.productId)}
                  onSelect={(productId) => selectProduct(line.id, productId)}
                  hasError={Boolean(lineError?.product)}
                />
                {lineError?.product && <p className="mt-1 text-xs text-danger-text">{lineError.product}</p>}
                {product && (
                  <p className={`mt-1 text-xs ${tooMany ? 'text-warn-text' : 'text-muted'}`}>
                    {product.quantity} {product.unit} in stock
                    {tooMany && ' — more than you have on record'}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={`quantity-${line.id}`} className={labelClasses}>
                  Quantity
                </label>
                <input
                  id={`quantity-${line.id}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={line.quantity}
                  onChange={(event) => updateField(line.id, 'quantity', event.target.value)}
                  placeholder="e.g. 5"
                  aria-invalid={Boolean(lineError?.quantity)}
                  className={`${inputClasses} ${lineError?.quantity ? 'border-danger-text' : 'border-line'}`}
                />
                {lineError?.quantity && <p className="mt-1 text-xs text-danger-text">{lineError.quantity}</p>}
              </div>

              <div>
                <label htmlFor={`price-${line.id}`} className={labelClasses}>
                  {MODES[mode].priceLabel}
                </label>
                <input
                  id={`price-${line.id}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(event) => updateField(line.id, 'unitPrice', event.target.value)}
                  placeholder="e.g. 10"
                  aria-invalid={Boolean(lineError?.unitPrice)}
                  className={`${inputClasses} ${lineError?.unitPrice ? 'border-danger-text' : 'border-line'}`}
                />
                {lineError?.unitPrice && <p className="mt-1 text-xs text-danger-text">{lineError.unitPrice}</p>}
              </div>

              <p className="text-sm font-medium text-ink md:pt-2 md:text-right">
                <span className="mr-2 text-xs font-medium text-muted md:hidden">Amount</span>
                {formatCurrency(lineTotal(line.quantity, line.unitPrice))}
              </p>

              <button
                type="button"
                onClick={() => removeLine(line.id)}
                disabled={isSaving}
                aria-label={`Remove item ${index + 1}`}
                className="flex h-9 w-9 items-center justify-center justify-self-end rounded-full text-muted hover:bg-danger-bg hover:text-danger-text md:mt-0.5"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={addLine}
        disabled={isSaving || lines.length >= MAX_LINES}
        className="mt-4 flex items-center gap-2 rounded-full border border-dashed border-sage px-4 py-2 text-sm font-medium text-forest hover:bg-sage-light disabled:opacity-60"
      >
        <Plus size={16} aria-hidden="true" />
        Add another item
      </button>

      {shortages && (
        <div role="alert" className="mt-5 rounded-xl border border-warn-bar bg-warn-bg p-4 text-sm text-warn-text">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert size={16} aria-hidden="true" />
            Not enough stock on record
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {shortages.map((shortage) => (
              <li key={shortage.productId}>
                {shortage.productName}: you entered {shortage.requested}, but only {shortage.available} in stock.
              </li>
            ))}
          </ul>
          <p className="mt-2">
            If your records are behind, you can record the sale anyway. Stock for these items
            will be set to 0, and you will be reminded to check it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => submit(true)} disabled={isSaving} className={primaryButton}>
              Record anyway
            </button>
            <button type="button" onClick={() => setShortages(null)} disabled={isSaving} className={secondaryButton}>
              Go back and edit
            </button>
          </div>
        </div>
      )}

      {formError && (
        <p role="alert" className="mt-5 text-sm text-danger-text">
          {formError}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-sm text-muted">
          Total <span className="ml-1 text-xl font-semibold text-ink">{formatCurrency(total)}</span>
        </p>
        <button type="button" onClick={() => submit(false)} disabled={isSaving} className={primaryButton}>
          {isSaving ? 'Saving...' : mode === 'sale' ? 'Confirm sale' : 'Confirm purchase'}
        </button>
      </div>
    </section>
  )
}

export default UpdateStockPage
