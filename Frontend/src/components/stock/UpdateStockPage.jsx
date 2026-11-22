import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import EntrySection from './EntrySection'
import ReadInputPanel from './ReadInputPanel'
import { formatCurrency } from '../../utils/inventoryUtils'
import { placeLine, splitDraft } from '../../utils/stockEntry'
import { useEntrySection } from '../../utils/useEntrySection'

const cardClasses = 'rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6'
const primaryButton =
  'rounded-full bg-forest px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-deep disabled:cursor-not-allowed disabled:opacity-60'
const choiceButton =
  'rounded-full border border-forest px-3 py-1 text-xs font-medium text-forest transition-colors hover:bg-sage-light'

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

// Update Stock: two lists on one page, Sales (stock goes down) on top and Purchases (stock goes up)
// below it. Type items into either list, or read a voice note or a bill photo: a note that mixes both
// ("5 Maggi bika, Parle-G 50 aaye") fills both lists at once. Each list has its own total and Confirm,
// and nothing is saved until Confirm.
function UpdateStockPage({ products, isLoading, loadError, onRefresh, onNavigate }) {
  const sales = useEntrySection({ mode: 'sale', products, onRefresh })
  const purchases = useEntrySection({ mode: 'purchase', products, onRefresh })
  // Lines read from a note or bill whose kind (sale or purchase) could not be told. Nothing is guessed:
  // the owner puts each one in a list.
  const [unsure, setUnsure] = useState([])
  const [draftWarnings, setDraftWarnings] = useState([])
  const [draftNote, setDraftNote] = useState('')

  function applyDraft(draft, origin) {
    const found = splitDraft(draft, products, origin)
    sales.addLines(found.sale, origin)
    purchases.addLines(found.purchase, origin)
    setUnsure((current) => [...current, ...found.unsure])
    setDraftWarnings(draft.warnings)

    const parts = [
      found.sale.length > 0 && plural(found.sale.length, 'sale item'),
      found.purchase.length > 0 && plural(found.purchase.length, 'purchase item'),
      found.unsure.length > 0 && `${plural(found.unsure.length, 'item')} to place`,
    ].filter(Boolean)
    const from = origin === 'voice' ? 'your voice note' : 'your bill'
    setDraftNote(
      parts.length > 0 ? `Read ${parts.join(', ')} from ${from}. Check each list before you confirm.` : '',
    )
  }

  function place(line, mode) {
    const section = mode === 'sale' ? sales : purchases
    const product = products.find((candidate) => candidate.id === line.productId)
    section.addLines([placeLine(line, product, mode)], line.hint?.origin ?? 'voice')
    setUnsure((current) => current.filter((item) => item.id !== line.id))
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

  return (
    <div className="space-y-5">
      <section aria-label="Add items" className={cardClasses}>
        <ReadInputPanel
          disabled={sales.phase === 'saving' || purchases.phase === 'saving'}
          onDraft={applyDraft}
        />

        {draftNote && (
          <p role="status" className="mt-4 text-sm font-medium text-ink">
            {draftNote}
          </p>
        )}

        {unsure.length > 0 && (
          <div className="mt-4 rounded-xl border border-warn-bar bg-warn-bg p-4 text-sm text-warn-text">
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert size={16} aria-hidden="true" />
              Is this a sale or a purchase?
            </p>
            <p className="mt-1">
              These items did not say whether stock came in or went out. Choose where each one belongs.
            </p>
            <ul className="mt-3 space-y-2">
              {unsure.map((line) => {
                const product = products.find((candidate) => candidate.id === line.productId)
                return (
                  <li
                    key={line.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2"
                  >
                    <span className="text-ink">
                      <span className="font-medium">{product ? product.name : 'Unknown product'}</span>
                      {line.quantity !== '' && ` × ${line.quantity}`}
                      {line.unitPrice !== '' && ` at ${formatCurrency(Number(line.unitPrice))}`}
                      {line.hint?.text && (
                        <span className="ml-2 text-xs text-muted">
                          {line.hint.origin === 'voice' ? 'Heard' : 'Read'}: “{line.hint.text}”
                        </span>
                      )}
                    </span>
                    <span className="flex gap-2">
                      <button type="button" onClick={() => place(line, 'sale')} className={choiceButton}>
                        Sale
                      </button>
                      <button type="button" onClick={() => place(line, 'purchase')} className={choiceButton}>
                        Purchase
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {draftWarnings.length > 0 && (
          <div role="status" className="mt-4 rounded-xl border border-warn-bar bg-warn-bg p-4 text-sm text-warn-text">
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert size={16} aria-hidden="true" />
              Check every line before you confirm
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {draftWarnings.map((warning, index) => (
                <li key={`${index}-${warning}`}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <EntrySection section={sales} products={products} onNavigate={onNavigate} />
      <EntrySection section={purchases} products={products} onNavigate={onNavigate} />
    </div>
  )
}

export default UpdateStockPage
