import { useEffect } from 'react'
import { TriangleAlert } from 'lucide-react'
import StockStatusBadge from './StockStatusBadge'
import { getStockStatus } from '../utils/inventoryUtils'
import { useLockBodyScroll } from '../utils/useLockBodyScroll'

function LowStockAlertModal({ alert, onClose, onViewInventory }) {
  useLockBodyScroll(true)

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Out-of-stock products first, because they are the most urgent.
  const items = [...alert.items].sort((a, b) => {
    const aOut = getStockStatus(a) === 'out-of-stock' ? 0 : 1
    const bOut = getStockStatus(b) === 'out-of-stock' ? 0 : 1
    return aOut - bOut
  })

  const allOut = items.every((item) => getStockStatus(item) === 'out-of-stock')
  const isSummary = alert.kind === 'summary'

  let title
  let message
  if (isSummary) {
    title = items.length === 1 ? '1 product needs restocking' : `${items.length} products need restocking`
    message = 'These products are low on stock or have run out.'
  } else if (allOut) {
    title = 'Product is out of stock'
    message = `${items[0].name} has run out of stock.`
  } else {
    title = 'Low stock warning'
    message = `${items[0].name} is running low. Consider restocking soon.`
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="stock-alert-title"
        aria-describedby="stock-alert-message"
        className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-2xl bg-white p-6 shadow-xl"
      >
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            allOut ? 'bg-danger-bg text-danger-text' : 'bg-warn-bg text-warn-text'
          }`}
        >
          <TriangleAlert size={22} aria-hidden="true" />
        </div>

        <h2 id="stock-alert-title" className="mt-4 text-xl font-semibold text-ink">
          {title}
        </h2>
        <p id="stock-alert-message" className="mt-1 text-sm text-muted">
          {message}
        </p>

        <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                <p className="text-xs text-muted">
                  {item.quantity} {item.unit} left · Min: {item.lowStockThreshold}
                </p>
              </div>
              <StockStatusBadge status={getStockStatus(item)} />
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onViewInventory}
            className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-deep"
          >
            Go to inventory
          </button>
        </div>
      </div>
    </div>
  )
}

export default LowStockAlertModal