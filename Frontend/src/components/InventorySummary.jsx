import { Package, PackageX, TriangleAlert } from 'lucide-react'
import SummaryCard from './SummaryCard'
import { getStockCounts } from '../utils/inventoryUtils'

function InventorySummary({ products }) {
  const counts = getStockCounts(products)
  return (
    <section aria-label="Inventory summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SummaryCard label="Total Products" value={counts.total} icon={Package} tone="sage" />
      <SummaryCard label="Low Stock" value={counts.lowStock} icon={TriangleAlert} tone="amber" />
      <SummaryCard label="Out of Stock" value={counts.outOfStock} icon={PackageX} tone="red" />
    </section>
  )
}

export default InventorySummary
