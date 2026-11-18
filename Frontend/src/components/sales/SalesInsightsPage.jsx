import { useMemo, useState } from 'react'
import {
  getCategorySales,
  getRevenueComparison,
  getSalesTrend,
  getTopSellingProducts,
} from '../../data/salesData'
import { resolveDateRange } from '../../utils/salesUtils'
import './sales.css'
import RevenueAnalysis from './RevenueAnalysis'
import SalesByCategory from './SalesByCategory'
import SalesInsightsHeader from './SalesInsightsHeader'
import SalesTrend from './SalesTrend'
import TopSellingProducts from './TopSellingProducts'

// Fades each section in one after another when the page opens.
// className sets the layer order, so a section's dropdown opens above the card below it.
function Reveal({ delay = 0, className = '', children }) {
  return (
    <div className={`animate-rise min-w-0 ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

export default function SalesInsightsPage() {
  // The page-level filter at the top
  const [dateRange, setDateRange] = useState({
    preset: 'last30',
    customStart: '',
    customEnd: '',
  })

  // Each block can have its own range. null means "follow the page filter".
  const [categoryOverride, setCategoryOverride] = useState(null)
  const [productOverride, setProductOverride] = useState(null)

  // Changing the page filter makes every block follow it again
  const handlePageRangeChange = (next) => {
    setDateRange(next)
    setCategoryOverride(null)
    setProductOverride(null)
  }

  const categoryFilter = categoryOverride ?? dateRange
  const productFilter = productOverride ?? dateRange

  const pageRange = useMemo(() => resolveDateRange(dateRange), [dateRange])
  const categoryRange = useMemo(() => resolveDateRange(categoryFilter), [categoryFilter])
  const productRange = useMemo(() => resolveDateRange(productFilter), [productFilter])

  // Later, replace these functions with calls to your backend, passing each range's start and end.
  const trend = useMemo(() => getSalesTrend(pageRange), [pageRange])
  const revenue = useMemo(() => getRevenueComparison(pageRange), [pageRange])
  const categories = useMemo(() => getCategorySales(categoryRange), [categoryRange])
  const topSelling = useMemo(() => getTopSellingProducts(productRange), [productRange])

  return (
    <div className="sales-insights-page mx-auto min-w-0 max-w-[1400px] space-y-6">
      <Reveal className="relative z-30">
        <SalesInsightsHeader dateRange={dateRange} onDateRangeChange={handlePageRangeChange} />
      </Reveal>
      <Reveal delay={80} className="relative z-20">
        <SalesByCategory
          data={categories}
          dateRange={categoryFilter}
          onDateRangeChange={setCategoryOverride}
        />
      </Reveal>
      <Reveal delay={160}>
        <SalesTrend data={trend} />
      </Reveal>
      <Reveal delay={240} className="relative z-10">
        <TopSellingProducts
          products={topSelling}
          dateRange={productFilter}
          onDateRangeChange={setProductOverride}
        />
      </Reveal>
      <Reveal delay={320}>
        <RevenueAnalysis data={revenue} />
      </Reveal>
    </div>
  )
}