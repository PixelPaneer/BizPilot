import { Check, Plus, Trash2, TriangleAlert } from 'lucide-react'
import ProductPicker from './ProductPicker'
import { formatCurrency } from '../../utils/inventoryUtils'
import { MAX_LINES, MODES, entryTotal, isBlankList, lineTotal } from '../../utils/stockEntry'

const inputClasses =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-forest focus:outline-none'
const cardClasses = 'rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6'
const primaryButton =
  'rounded-full bg-forest px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-deep disabled:cursor-not-allowed disabled:opacity-60'
const secondaryButton =
  'rounded-full border border-line px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60'

const COPY = {
  sale: {
    title: 'Sales',
    badge: 'Stock goes down',
    description:
      'Record what you sold. The sale shows in your reports. Prices start from your catalog; change them if the customer paid something different.',
  },
  purchase: {
    title: 'Purchases',
    badge: 'Stock goes up',
    description:
      'Record stock you received from a supplier. The price you enter becomes the product’s buying price.',
  },
}

function SectionHeader({ mode }) {
  const copy = COPY[mode]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-xl font-semibold text-ink">{copy.title}</h2>
      <span className="rounded-full bg-sage-light px-2.5 py-0.5 text-xs font-medium text-forest">
        {copy.badge}
      </span>
    </div>
  )
}

// One list on the Update Stock page: its lines to fill in and check, a total and its own Confirm button;
// after saving, the result of that entry. `section` comes from useEntrySection.
function EntrySection({ section, products, onNavigate }) {
  const { mode, lines, errors, phase, showErrors, formError, shortages, result, undo } = section
  const isSale = mode === 'sale'
  const isSaving = phase === 'saving'

  // ------------------------------------------------------------------ saved
  if (phase === 'done' && result) {
    const voided = undo?.voided

    return (
      <section aria-label={`${COPY[mode].title} saved`} className={cardClasses}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-light text-deep">
            <Check size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-ink">
              {voided ? 'Sale undone' : isSale ? 'Sale recorded' : 'Purchase recorded'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isSale && <span className="font-medium text-ink">{result.saleNumber}</span>}
              {isSale && ' · '}
              Total {formatCurrency(result.totalAmount)}
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
              {result.lines.map((line) => (
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

        {[...(result.warnings ?? []), ...(voided?.warnings ?? [])].map((warning) => (
          <p key={warning} className="mt-3 flex items-start gap-2 text-sm text-warn-text">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {warning}
          </p>
        ))}

        {undo && !voided && (
          <div className="mt-5 rounded-xl border border-line bg-cream p-4">
            <label htmlFor={`undo-reason-${mode}`} className="block text-sm font-medium text-ink">
              Why are you undoing this sale?
            </label>
            <input
              id={`undo-reason-${mode}`}
              type="text"
              maxLength={200}
              value={undo.reason}
              onChange={(event) => section.setUndo({ ...undo, reason: event.target.value, error: '' })}
              className={`${inputClasses} mt-2 border-line`}
            />
            {undo.error && (
              <p role="alert" className="mt-2 text-sm text-danger-text">
                {undo.error}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={section.voidSale} disabled={undo.saving} className={primaryButton}>
                {undo.saving ? 'Undoing...' : 'Undo sale'}
              </button>
              <button type="button" onClick={() => section.setUndo(null)} disabled={undo.saving} className={secondaryButton}>
                Keep sale
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={section.reset} className={primaryButton}>
            Record another {isSale ? 'sale' : 'purchase'}
          </button>
          <button type="button" onClick={() => onNavigate('inventory')} className={secondaryButton}>
            Back to inventory
          </button>
          {isSale && !undo && !voided && (
            <button
              type="button"
              onClick={() => section.setUndo({ reason: 'Entered by mistake', saving: false, error: '', voided: null })}
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
  const total = entryTotal(lines)
  const blank = isBlankList(lines)
  const { priceLabel } = MODES[mode]

  return (
    <section aria-label={COPY[mode].title} className={cardClasses}>
      <SectionHeader mode={mode} />
      <p className="mt-2 text-sm text-muted">{COPY[mode].description}</p>

      <div className="mt-5 hidden grid-cols-[minmax(0,2fr)_110px_130px_110px_40px] gap-3 text-xs font-medium uppercase tracking-wide text-muted md:grid">
        <span>Product</span>
        <span>Quantity</span>
        <span>{priceLabel}</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      <div className="mt-2 space-y-4 md:space-y-3">
        {lines.map((line, index) => {
          const product = section.productsById.get(line.productId)
          const lineError = showErrors ? errors[line.id] : undefined
          const quantity = Number(line.quantity)
          const tooMany = isSale && product && quantity > product.quantity

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
                  label={`${COPY[mode].title}: product, item ${index + 1}`}
                  products={products}
                  selectedId={line.productId}
                  excludeIds={usedIds.filter((id) => id !== line.productId)}
                  onSelect={(productId) => section.selectProduct(line.id, productId)}
                  hasError={Boolean(lineError?.product)}
                />
                {lineError?.product && <p className="mt-1 text-xs text-danger-text">{lineError.product}</p>}
                {line.hint?.text && (
                  <p className="mt-1 text-xs text-muted">
                    {line.hint.origin === 'voice' ? 'Heard' : 'Read'}: “{line.hint.text}”
                  </p>
                )}
                {!product && line.hint?.candidates?.some((candidate) => !usedIds.includes(candidate.productId)) && (
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    Did you mean
                    {line.hint.candidates
                      .filter((candidate) => !usedIds.includes(candidate.productId))
                      .map((candidate) => (
                        <button
                          key={candidate.productId}
                          type="button"
                          onClick={() => section.selectProduct(line.id, candidate.productId)}
                          className="rounded-full border border-forest px-2 py-0.5 font-medium text-forest hover:bg-sage-light"
                        >
                          {candidate.name}
                        </button>
                      ))}
                  </p>
                )}
                {product && line.hint?.unit && line.hint.unit !== product.unit && (
                  <p className="mt-1 text-xs text-warn-text">
                    {line.hint.origin === 'voice' ? 'You said' : 'The bill says'} {line.hint.unit}, but this
                    product is counted in {product.unit}. Check the quantity.
                  </p>
                )}
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
                  onChange={(event) => section.updateField(line.id, 'quantity', event.target.value)}
                  placeholder="e.g. 5"
                  aria-invalid={Boolean(lineError?.quantity)}
                  className={`${inputClasses} ${lineError?.quantity ? 'border-danger-text' : 'border-line'}`}
                />
                {lineError?.quantity && <p className="mt-1 text-xs text-danger-text">{lineError.quantity}</p>}
              </div>

              <div>
                <label htmlFor={`price-${line.id}`} className={labelClasses}>
                  {priceLabel}
                </label>
                <input
                  id={`price-${line.id}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(event) => section.updateField(line.id, 'unitPrice', event.target.value)}
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
                onClick={() => section.removeLine(line.id)}
                disabled={isSaving}
                aria-label={`Remove ${COPY[mode].title.toLowerCase()} item ${index + 1}`}
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
        onClick={section.addLine}
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
            <button type="button" onClick={() => section.submit(true)} disabled={isSaving} className={primaryButton}>
              Record anyway
            </button>
            <button type="button" onClick={() => section.setShortages(null)} disabled={isSaving} className={secondaryButton}>
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
        <button
          type="button"
          onClick={() => section.submit(false)}
          disabled={isSaving || blank}
          title={blank ? `Add at least one ${isSale ? 'sale' : 'purchase'} item first` : undefined}
          className={primaryButton}
        >
          {isSaving ? 'Saving...' : isSale ? 'Confirm sale' : 'Confirm purchase'}
        </button>
      </div>
    </section>
  )
}

export default EntrySection
