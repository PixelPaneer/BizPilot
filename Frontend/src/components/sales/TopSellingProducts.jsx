import { Trophy } from 'lucide-react'
import { formatNumber } from '../../utils/salesUtils'
import DateRangeFilter from './DateRangeFilter'
import { Card, CardHeader } from './SalesUI'
import { CATEGORY_COLORS, FALLBACK_COLOR } from './salesConstants'

// The header row stays pinned while the rows scroll underneath it
const headCell =
  'sales-table-head sticky top-0 z-10 px-3 py-2.5 whitespace-nowrap first:rounded-l-lg last:rounded-r-lg'
const bodyCell = 'px-3 py-3.5 whitespace-nowrap'

function CategoryPill({ category }) {
  return (
    <span className="sales-category-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
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
        className="sales-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
        style={{ backgroundColor: `${color}33` }}
      >
        {name.charAt(0)}
      </span>
      <span className="sales-heading font-medium">{name}</span>
    </div>
  )
}

function RankBadge({ rank }) {
  const style =
    rank === 1
      ? 'sales-rank-first'
      : rank <= 3
        ? 'sales-rank-other'
        : 'sales-rank-muted'
  return (
    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${style}`}>
      {rank}
    </span>
  )
}

export default function TopSellingProducts({ products, dateRange, onDateRangeChange }) {
  return (
    <Card className="relative">
      <CardHeader
        icon={Trophy}
        title="Top Selling Products"
        subtitle={`${products.length} products ranked by revenue.`}
        action={<DateRangeFilter value={dateRange} onChange={onDateRangeChange} />}
      />

      {/* Scrolls up and down inside the card, so the page itself stays short */}
      <div className="max-h-[440px] overflow-auto pr-1 [scrollbar-color:var(--sales-border)_transparent] [scrollbar-width:thin]">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="sales-muted text-left text-xs font-medium">
              <th className={`${headCell} w-12`}>#</th>
              <th className={headCell}>Product Name</th>
              <th className={headCell}>Category</th>
              <th className={`${headCell} text-right`}>Units Sold</th>
              <th className={`${headCell} text-right`}>Revenue (₹)</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr
                key={p.productName}
                className="sales-table-row border-b transition-colors last:border-0 hover:bg-[var(--sales-surface-hover)]"
              >
                <td className={bodyCell}>
                  <RankBadge rank={i + 1} />
                </td>
                <td className={bodyCell}>
                  <ProductCell name={p.productName} category={p.category} />
                </td>
                <td className={bodyCell}>
                  <CategoryPill category={p.category} />
                </td>
                <td className={`sales-heading ${bodyCell} text-right tabular-nums`}>
                  {formatNumber(p.unitsSold)}
                </td>
                <td className={`sales-heading ${bodyCell} text-right font-semibold tabular-nums`}>
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