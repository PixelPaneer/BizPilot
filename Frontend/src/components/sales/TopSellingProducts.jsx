import { Trophy } from 'lucide-react'
import { formatNumber } from '../../utils/salesUtils'
import DateRangeFilter from './DateRangeFilter'
import { Card, CardHeader } from './SalesUI'
import { CATEGORY_COLORS, FALLBACK_COLOR } from './salesConstants'

// The header row stays pinned while the rows scroll underneath it
const headCell =
<<<<<<< origin/Frontend_v2
  'sales-table-head sticky top-0 z-10 px-3 py-2.5 whitespace-nowrap first:rounded-l-lg last:rounded-r-lg'
=======
  'sticky top-0 z-10 bg-[#F7F3EA] px-3 py-2.5 whitespace-nowrap first:rounded-l-lg last:rounded-r-lg'
>>>>>>> origin/frontend-insights-anwesha
const bodyCell = 'px-3 py-3.5 whitespace-nowrap'

function CategoryPill({ category }) {
  return (
<<<<<<< origin/Frontend_v2
    <span className="sales-category-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
=======
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3EFE6] px-2.5 py-1 text-xs font-medium text-[#5E655F]">
>>>>>>> origin/frontend-insights-anwesha
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
<<<<<<< origin/Frontend_v2
        className="sales-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
=======
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-[#244F3D]"
>>>>>>> origin/frontend-insights-anwesha
        style={{ backgroundColor: `${color}33` }}
      >
        {name.charAt(0)}
      </span>
<<<<<<< origin/Frontend_v2
      <span className="sales-heading font-medium">{name}</span>
=======
      <span className="font-medium text-[#1F2D27]">{name}</span>
>>>>>>> origin/frontend-insights-anwesha
    </div>
  )
}

function RankBadge({ rank }) {
  const style =
    rank === 1
<<<<<<< origin/Frontend_v2
      ? 'sales-rank-first'
      : rank <= 3
        ? 'sales-rank-other'
        : 'sales-rank-muted'
=======
      ? 'bg-[#244F3D] text-white'
      : rank <= 3
        ? 'bg-[#E8EFE6] text-[#244F3D]'
        : 'text-[#7A8079]'
>>>>>>> origin/frontend-insights-anwesha
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
<<<<<<< origin/Frontend_v2
      <div className="max-h-[440px] overflow-auto pr-1 [scrollbar-color:var(--sales-border)_transparent] [scrollbar-width:thin]">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="sales-muted text-left text-xs font-medium">
=======
      <div className="max-h-[440px] overflow-auto pr-1 [scrollbar-color:#D9D2C3_transparent] [scrollbar-width:thin]">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-[#7A8079]">
>>>>>>> origin/frontend-insights-anwesha
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
<<<<<<< origin/Frontend_v2
                className="sales-table-row border-b transition-colors last:border-0 hover:bg-[var(--sales-surface-hover)]"
=======
                className="border-b border-[#F1ECE2] transition-colors last:border-0 hover:bg-[#FBF8F1]"
>>>>>>> origin/frontend-insights-anwesha
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
<<<<<<< origin/Frontend_v2
                <td className={`sales-heading ${bodyCell} text-right tabular-nums`}>
                  {formatNumber(p.unitsSold)}
                </td>
                <td className={`sales-heading ${bodyCell} text-right font-semibold tabular-nums`}>
=======
                <td className={`${bodyCell} text-right tabular-nums text-[#1F2D27]`}>
                  {formatNumber(p.unitsSold)}
                </td>
                <td className={`${bodyCell} text-right font-semibold tabular-nums text-[#1F2D27]`}>
>>>>>>> origin/frontend-insights-anwesha
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