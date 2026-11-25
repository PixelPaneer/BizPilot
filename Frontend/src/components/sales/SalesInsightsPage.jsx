
import { useMemo, useState } from 'react'
import {
  getCategorySales,
  getRevenueComparison,
  getSalesTrend,
  getTopSellingProducts,
} from '../../data/salesData'
import { resolveDateRange } from '../../utils/salesUtils'
import BusinessInsights from '../insights/BusinessInsights'
import RevenueAnalysis from './RevenueAnalysis'
import SalesByCategory from './SalesByCategory'
import SalesInsightsHeader from './SalesInsightsHeader'
import SalesTrend from './SalesTrend'
import TopSellingProducts from './TopSellingProducts'

// Fades each section in one after another when the page opens.
function Reveal({ delay = 0, className = '', children }) {
  return (
    <div
      className={`animate-rise min-w-0 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export default function SalesInsightsPage() {
  const [dateRange, setDateRange] = useState({
    preset: 'last30',
    customStart: '',
    customEnd: '',
  })

  const [categoryOverride, setCategoryOverride] = useState(null)
  const [productOverride, setProductOverride] = useState(null)

  const handlePageRangeChange = (next) => {
    setDateRange(next)
    setCategoryOverride(null)
    setProductOverride(null)
  }

  const categoryFilter = categoryOverride ?? dateRange
  const productFilter = productOverride ?? dateRange

  const pageRange = useMemo(() => resolveDateRange(dateRange), [dateRange])
  const categoryRange = useMemo(
    () => resolveDateRange(categoryFilter),
    [categoryFilter]
  )
  const productRange = useMemo(
    () => resolveDateRange(productFilter),
    [productFilter]
  )

  // Existing chart data calculations remain unchanged.
  const trend = useMemo(() => getSalesTrend(pageRange), [pageRange])
  const revenue = useMemo(
    () => getRevenueComparison(pageRange),
    [pageRange]
  )
  const categories = useMemo(
    () => getCategorySales(categoryRange),
    [categoryRange]
  )
  const topSelling = useMemo(
    () => getTopSellingProducts(productRange),
    [productRange]
  )

  return (
    <div className="mx-auto min-w-0 max-w-[1400px] space-y-6">
      <Reveal className="relative z-30">
        <SalesInsightsHeader
          dateRange={dateRange}
          onDateRangeChange={handlePageRangeChange}
        />
      </Reveal>

      {/* AI Business Insights - independent of existing chart data */}
      <Reveal delay={80}>
        <BusinessInsights />
      </Reveal>

      {/* Revenue Analysis directly below AI Business Insights */}
      <Reveal delay={160}>
        <RevenueAnalysis data={revenue} />
      </Reveal>

      {/* Remaining existing charts */}
      <Reveal delay={240} className="relative z-20">
        <SalesByCategory
          data={categories}
          dateRange={categoryFilter}
          onDateRangeChange={setCategoryOverride}
        />
      </Reveal>

      <Reveal delay={320}>
        <SalesTrend data={trend} />
      </Reveal>

      <Reveal delay={400} className="relative z-10">
        <TopSellingProducts
          products={topSelling}
          dateRange={productFilter}
          onDateRangeChange={setProductOverride}
        />
      </Reveal>
    </div>
  )
}
