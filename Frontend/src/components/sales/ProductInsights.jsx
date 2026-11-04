import { ChevronRight, Package, Trophy } from 'lucide-react'
import { formatNumber } from '../../utils/salesUtils'
import { CATEGORY_COLORS, Card, CardHeader, FALLBACK_COLOR } from './SalesUI'

const headCell =
  'px-3 py-2.5 whitespace-nowrap first:rounded-l-lg last:rounded-r-lg'
const bodyCell = 'px-3 py-3.5 whitespace-nowrap'
const rowClass =
  'border-b border-[#F1ECE2] transition-colors last:border-0 hover:bg-[#FBF8F1]'

function ViewAllButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#244F3D] transition-colors hover:bg-[#E8EFE6]"
    >
      View All
      <ChevronRight className="h-4 w-4" />
    </button>
  )
}

function CategoryPill({ category }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3EFE6] px-2.5 py-1 text-xs font-medium text-[#5E655F]">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: CATEGORY_COLORS[category] ?? FALLBACK_COLOR }}
      />
      {category}
    </span>
  )
}

function ProductCell({ name, category }) {
  const color = CATEGORY_COLORS[category] ?? FALLBACK_COLOR
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-[#244F3D]"
        style={{ backgroundColor: `${color}33` }}
      >
        {name.charAt(0)}
      </span>
      <span className="font-medium text-[#1F2D27]">{name}</span>
    </div>
  )
}

function RankBadge({ rank }) {
  const style =
    rank === 1
      ? 'bg-[#244F3D] text-white'
      : rank <= 3
        ? 'bg-[#E8EFE6] text-[#244F3D]'
        : 'text-[#7A8079]'
  return (
    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${style}`}>
      {rank}
    </span>
  )
}

function StatusBadge({ status }) {
  const out = status === 'Out of Stock'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        out ? 'bg-[#F6DCD8] text-[#A3433A]' : 'bg-[#F7E7C8] text-[#8A5A14]'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${out ? 'bg-[#C9594D]' : 'bg-[#D9922B]'}`} />
      {status}
    </span>
  )
}

function TopSellingProducts({ products, limit = 5, onViewAll }) {
  return (
    <Card>
      <CardHeader
        icon={Trophy}
        title="Top Selling Products"
        action={<ViewAllButton onClick={onViewAll} />}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#F7F3EA] text-left text-xs font-medium text-[#7A8079]">
              <th className={`${headCell} w-10`}>#</th>
              <th className={headCell}>Product Name</th>
              <th className={headCell}>Category</th>
              <th className={`${headCell} text-right`}>Units Sold</th>
              <th className={`${headCell} text-right`}>Revenue (₹)</th>
            </tr>
          </thead>
          <tbody>
            {products.slice(0, limit).map((p, i) => (
              <tr key={p.productName} className={rowClass}>
                <td className={bodyCell}>
                  <RankBadge rank={i + 1} />
                </td>
                <td className={bodyCell}>
                  <ProductCell name={p.productName} category={p.category} />
                </td>
                <td className={bodyCell}>
                  <CategoryPill category={p.category} />
                </td>
                <td className={`${bodyCell} text-right tabular-nums text-[#1F2D27]`}>
                  {formatNumber(p.unitsSold)}
                </td>
                <td className={`${bodyCell} text-right font-semibold tabular-nums text-[#1F2D27]`}>
                  {formatNumber(p.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function LowStockProducts({ products, limit = 5, onViewAll }) {
  return (
    <Card>
      <CardHeader
        icon={Package}
        title="Low-Stock Products"
        action={<ViewAllButton onClick={onViewAll} />}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#F7F3EA] text-left text-xs font-medium text-[#7A8079]">
              <th className={`${headCell} w-10`}>#</th>
              <th className={headCell}>Product Name</th>
              <th className={headCell}>Category</th>
              <th className={`${headCell} text-right`}>Current Stock</th>
              <th className={`${headCell} text-right`}>Threshold</th>
              <th className={headCell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.slice(0, limit).map((p, i) => {
              const ratio = p.threshold ? Math.min(p.currentStock / p.threshold, 1) : 0
              const out = p.status === 'Out of Stock'
              return (
                <tr key={p.productName} className={rowClass}>
                  <td className={`${bodyCell} text-xs text-[#7A8079]`}>{i + 1}</td>
                  <td className={bodyCell}>
                    <ProductCell name={p.productName} category={p.category} />
                  </td>
                  <td className={bodyCell}>
                    <CategoryPill category={p.category} />
                  </td>
                  <td className={bodyCell}>
                    <div className="flex items-center justify-end gap-2.5">
                      <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-[#F1ECE2] sm:block">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(ratio * 100, p.currentStock > 0 ? 8 : 0)}%`,
                            backgroundColor: out ? '#D98A80' : '#E6A18A',
                          }}
                        />
                      </div>
                      <span className="w-6 text-right font-semibold tabular-nums text-[#A3433A]">
                        {formatNumber(p.currentStock)}
                      </span>
                    </div>
                  </td>
                  <td className={`${bodyCell} text-right tabular-nums text-[#1F2D27]`}>
                    {formatNumber(p.threshold)}
                  </td>
                  <td className={bodyCell}>
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function ProductInsights({ topSelling, lowStock }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <TopSellingProducts products={topSelling} />
      <LowStockProducts products={lowStock} />
    </div>
  )
}