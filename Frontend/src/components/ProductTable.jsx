import { TriangleAlert } from 'lucide-react'
import StockStatusBadge from './StockStatusBadge'
import {
  getStockStatus,
  getStockPercent,
  formatPrice,
  getCategoryEmoji,
} from '../utils/inventoryUtils'

const barColors = {
  'in-stock': 'bg-sage',
  'low-stock': 'bg-warn-bar',
  'out-of-stock': 'bg-danger-bg',
}

function ProductTable({ products, emptyMessage, onSelectProduct }) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-muted">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-muted">
            <th className="px-3 py-3 font-medium">Product Name</th>
            <th className="px-3 py-3 font-medium">Category</th>
            <th className="px-3 py-3 font-medium">Stock Level</th>
            <th className="px-3 py-3 font-medium">Amount</th>
            <th className="px-3 py-3 font-medium">Status</th>
          </tr>
        </thead>

        <tbody>
          {products.map((product) => {
            const status = getStockStatus(product)
            const isLow = status === 'low-stock'

            return (
              <tr
                key={product.id}
                className={`border-b border-line last:border-0 ${isLow ? 'bg-warn-bg/30' : ''}`}
              >
                <td className="px-3 py-4">
                  <button
                    type="button"
                    onClick={() => onSelectProduct(product)}
                    aria-label={`Open actions for ${product.name}`}
                    title="Click to adjust stock, edit or delete"
                    className="flex items-center gap-3 rounded-lg text-left transition-colors hover:text-forest"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-sage-light text-lg"
                    >
                      {getCategoryEmoji(product.category)}
                    </span>
                    <span className="font-medium underline-offset-4 hover:underline">
                      {product.name}
                    </span>
                    {isLow && (
                      <TriangleAlert
                        size={15}
                        aria-label="Low stock warning"
                        className="text-warn-text"
                      />
                    )}
                  </button>
                </td>

                <td className="px-3 py-4 text-ink">{product.category}</td>

                <td className="px-3 py-4">
                  <div className="w-40">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-ink">{product.quantity} units</span>
                      <span className="text-muted">Min: {product.lowStockThreshold}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full ${barColors[status]}`}
                        style={{ width: `${getStockPercent(product)}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="px-3 py-4 text-ink">
                  {formatPrice(product.price, product.unit)}
                </td>

                <td className="px-3 py-4">
                  <StockStatusBadge status={status} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default ProductTable