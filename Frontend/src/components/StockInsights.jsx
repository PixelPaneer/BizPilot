import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { dashboardPeriodParams, useEndpoint } from '../utils/analyticsApi'
import { formatCurrency } from '../utils/inventoryUtils'

// What each card needs from its endpoint's answer (defined here so they stay the same function).
const productsOf = (data) => data.products
const suggestionsOf = (data) => data

const PERIOD_LABELS = { week: 'the last 7 days', month: 'this month', year: 'this year' }
const SORT_LABELS = { units: 'Units', revenue: 'Revenue' }
const REASONS = {
  OUT_OF_STOCK: { label: 'Out of stock', badge: 'badge--red' },
  RUNNING_OUT: { label: 'Running out', badge: 'badge--amber' },
  LOW_STOCK: { label: 'Low stock', badge: 'badge--amber' },
}
const LIST_SIZE = 5

// 3 -> "3", 2.5 -> "2.5", 0.3333 -> "0.333"
const quantity = (value) => String(Number(value.toFixed(3)))

// "By units" / "By revenue" switch used by the fast and slow movers cards.
function SortSwitch({ value, onChange }) {
  return (
    <div className="segmented" role="group" aria-label="Sort by">
      {Object.entries(SORT_LABELS).map(([key, label]) => (
        <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  )
}

// Shows the loading line, the error with a retry button, or the list once it has arrived.
function CardBody({ load, empty, children }) {
  if (load.isLoading) return <p className="insight__note" role="status">Loading…</p>

  if (load.error) {
    return (
      <div className="insight__note" role="alert">
        <p>Could not load this: {load.error}</p>
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

  const items = load.value
  if (!items || items.length === 0) return <p className="insight__note">{empty}</p>
  return <ul className="insight-list">{children(items)}</ul>
}

// Products to order now: out of stock, at or below their minimum, or selling fast enough to run
// out within a week. The suggested quantity comes from the server's rule.
function ReorderCard() {
  const load = useEndpoint(
    '/inventory/reorder-suggestions',
    { days: 30, limit: LIST_SIZE },
    suggestionsOf,
  )
  const total = load.value?.total ?? 0

  return (
    <section className="card insight-card">
      <div className="card__head">
        <div>
          <h2>Reorder suggestions</h2>
          <p>Based on stock and the last 30 days of sales</p>
        </div>
        <Link to="/inventory" className="link-more">
          Inventory <ArrowRight size={14} />
        </Link>
      </div>

      <CardBody
        load={{ ...load, value: load.value?.items }}
        empty="Nothing to reorder right now. Stock looks fine."
      >
        {(items) =>
          items.map((item) => {
            const reason = REASONS[item.reason]
            return (
              <li key={item.productId} className="insight">
                <span className="insight__main">
                  <span className="insight__name">{item.productName}</span>
                  <span className="insight__sub">
                    {quantity(item.quantity)} {item.unit} left
                    {item.weeklySales > 0
                      ? ` · sells about ${quantity(item.weeklySales)} a week`
                      : ' · no recent sales'}
                  </span>
                </span>
                <span className="insight__side">
                  <span className="insight__value">Order {quantity(item.suggestedQuantity)}</span>
                  <span className={`badge ${reason.badge}`}>{reason.label}</span>
                </span>
              </li>
            )
          })
        }
      </CardBody>

      {total > LIST_SIZE && (
        <p className="insight__sub mt-2">and {total - LIST_SIZE} more products need attention</p>
      )}
    </section>
  )
}

// The products that sell most (fast) or least (slow) in the dashboard's period.
function MoversCard({ kind, period }) {
  const isSlow = kind === 'slow'
  const [sort, setSort] = useState('units')
  const load = useEndpoint(
    isSlow ? '/analytics/slow-movers' : '/analytics/top-products',
    { ...dashboardPeriodParams(period), sort, limit: LIST_SIZE },
    productsOf,
  )

  return (
    <section className="card insight-card">
      <div className="card__head">
        <div>
          <h2>{isSlow ? 'Slow movers' : 'Fast movers'}</h2>
          <p>
            {isSlow ? 'In stock but selling least' : 'Selling most'}, {PERIOD_LABELS[period]}
          </p>
        </div>
        <SortSwitch value={sort} onChange={setSort} />
      </div>

      <CardBody
        load={load}
        empty={
          isSlow
            ? 'No slow movers yet. Products show up here after they have been in your shop for a week.'
            : 'No sales in this period yet.'
        }
      >
        {(items) =>
          items.map((item) => (
            <li key={item.productId ?? item.productName} className="insight">
              <span className="insight__main">
                <span className="insight__name">{item.productName}</span>
                <span className="insight__sub">
                  {item.category}
                  {isSlow ? ` · ${quantity(item.quantity)} ${item.unit} in stock` : ''}
                </span>
              </span>
              <span className="insight__side">
                <span className="insight__value">
                  {sort === 'units'
                    ? `${quantity(item.unitsSold)} sold`
                    : formatCurrency(item.revenue)}
                </span>
                <span className="insight__sub">
                  {sort === 'units'
                    ? formatCurrency(item.revenue)
                    : `${quantity(item.unitsSold)} sold`}
                </span>
              </span>
            </li>
          ))
        }
      </CardBody>
    </section>
  )
}

// The row of three cards under the dashboard's main cards. Each loads on its own, so one slow or
// failed request does not hide the others.
export default function StockInsights({ period }) {
  return (
    <div className="dashboard__row dashboard__row--insights">
      <ReorderCard />
      <MoversCard kind="slow" period={period} />
      <MoversCard kind="fast" period={period} />
    </div>
  )
}
