import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { toPercent } from '../utils/inventoryUtils'

function DashboardInventoryOverview({ stats }) {
  const inPct = toPercent(stats.inStock, stats.total)
  const lowPct = toPercent(stats.low, stats.total)
  const outPct = Math.max(0, 100 - inPct - lowPct)
  const segments = [
    { key: 'in', pct: inPct, className: 'seg--in' },
    { key: 'low', pct: lowPct, className: 'seg--low' },
    { key: 'out', pct: outPct, className: 'seg--out' },
  ]
  let start = 0
  const centers = segments.map((segment) => {
    const center = start + segment.pct / 2
    start += segment.pct
    return center
  })

  return (
    <section className="card">
      <div className="card__head">
        <div>
          <h2>Inventory Overview</h2>
          <p>Current stock status across all products</p>
        </div>
        <Link to="/inventory" className="link-more">
          View inventory <ArrowRight size={14} />
        </Link>
      </div>
      <div className="stock-bar-wrap">
        <div
          className="stock-bar"
          role="img"
          aria-label={`${inPct}% in stock, ${lowPct}% low, ${outPct}% out of stock`}
        >
          {segments.map((segment) => (
            <div
              key={segment.key}
              className={`stock-bar__seg ${segment.className}`}
              style={{ flexGrow: segment.pct, flexBasis: 0 }}
            />
          ))}
        </div>
        <div className="stock-bar__labels">
          {segments.map((segment, index) => (
            <span
              key={segment.key}
              className={`pct pct--${segment.key}`}
              style={{
                left: segment.key === 'low'
                  ? `${centers[index] - segment.pct / 2}%`
                  : `${centers[index]}%`,
              }}
            >
              {segment.pct}%
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

export default DashboardInventoryOverview
