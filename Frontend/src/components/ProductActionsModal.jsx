import { useEffect } from 'react'
import { X, Pencil, Trash2, PackagePlus } from 'lucide-react'
import StockStatusBadge from './StockStatusBadge'
import { getStockStatus, formatPrice } from '../utils/inventoryUtils'

function ProductActionsModal({ product, onEdit, onAdjustStock, onDelete, onClose }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const last = product.lastAdjustment

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
        aria-labelledby="product-actions-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="product-actions-title" className="text-xl font-semibold text-ink">
              {product.name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {product.category} · {formatPrice(product.price, product.unit)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-sage-light hover:text-forest"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3 text-sm text-ink">
          <span>{product.quantity} units</span>
          <StockStatusBadge status={getStockStatus(product)} />
        </div>

        {last && (
          <p className="mt-2 text-xs text-muted">
            Last adjustment: {last.type === 'add' ? 'added' : 'removed'} {last.amount} on{' '}
            {new Date(last.date).toLocaleDateString('en-IN')}
          </p>
        )}

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={onAdjustStock}
            className="flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-sage-light"
          >
            <PackagePlus size={16} aria-hidden="true" className="text-forest" />
            Adjust Stock
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-sage-light"
          >
            <Pencil size={16} aria-hidden="true" className="text-forest" />
            Edit Product
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm font-medium text-danger-text transition-colors hover:bg-danger-bg"
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete Product
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProductActionsModal