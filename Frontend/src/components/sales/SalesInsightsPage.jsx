import { useState } from 'react'
import { useAnalytics } from '../../utils/analyticsApi'
import AiInsights from '../insights/AiInsights'
import './sales.css'
import RevenueAnalysis from './RevenueAnalysis'
import SalesByCategory from './SalesByCategory'
import SalesInsightsHeader from './SalesInsightsHeader'
import SalesTrend from './SalesTrend'
import TopSellingProducts from './TopSellingProducts'

// What each chart needs from its endpoint's response.
const asIs = (data) => data
const categoriesOf = (data) => data.categories
const productsOf = (data) => data.products

// Fades each section in one after another when the page opens.
// className sets the layer order, so a section's dropdown opens above the card below it.
function Reveal({ delay = 0, className = '', children }) {
  return (
    <div className={`animate-rise min-w-0 ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

// Shows a loading line or the error (with a retry button) until a section's data has arrived.
function Loaded({ load, label, children }) {
  if (load.isLoading) {
    return (
      <div className="sales-card rounded-2xl p-6 text-center text-sm" role="status">
        Loading {label}…
      </div>
    )
  }

  if (load.error) {
    return (
      <div className="sales-card rounded-2xl p-6 text-center text-sm" role="alert">
        <p>Could not load {label}: {load.error}</p>
        <button
          type="button"
          onClick={load.retry}
          className="mt-3 rounded-full bg-forest px-5 py-2 text-sm font-medium text-white hover:bg-deep"
        >
          Try again
        </button>
      </div>
    )
  }

  return children(load.value)
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

  const trend = useAnalytics('sales-trend', dateRange, asIs)
  const revenue = useAnalytics('revenue-analysis', dateRange, asIs)
  const categories = useAnalytics('category-sales', categoryFilter, categoriesOf)
  const topSelling = useAnalytics('top-products', productFilter, productsOf)

  return (
    <div className="sales-insights-page mx-auto min-w-0 max-w-[1400px] space-y-6">
      <Reveal className="relative z-30">
        <SalesInsightsHeader dateRange={dateRange} onDateRangeChange={handlePageRangeChange} />
      </Reveal>
      <Reveal delay={80} className="relative z-20">
        <AiInsights key={dateRange.preset} period={dateRange.preset} />
      </Reveal>
      <Reveal delay={160} className="relative z-20">
        <Loaded load={categories} label="sales by category">
          {(data) => (
            <SalesByCategory
              data={data}
              dateRange={categoryFilter}
              onDateRangeChange={setCategoryOverride}
            />
          )}
        </Loaded>
      </Reveal>
      <Reveal delay={240}>
        <Loaded load={trend} label="the sales trend">
          {(data) => <SalesTrend data={data} />}
        </Loaded>
      </Reveal>
      <Reveal delay={320} className="relative z-10">
        <Loaded load={topSelling} label="top selling products">
          {(data) => (
            <TopSellingProducts
              products={data}
              dateRange={productFilter}
              onDateRangeChange={setProductOverride}
            />
          )}
        </Loaded>
      </Reveal>
      <Reveal delay={400}>
        <Loaded load={revenue} label="revenue analysis">
          {(data) => <RevenueAnalysis data={data} />}
        </Loaded>
      </Reveal>
    </div>
  )
}
