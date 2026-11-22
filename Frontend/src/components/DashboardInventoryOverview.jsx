import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { toPercent } from '../utils/inventoryUtils'

function DashboardInventoryOverview({ stats }) {
  if (stats.total === 0) {
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
        <p className="py-6 text-center text-sm text-muted">
          You have no products yet. Add your first product to see your stock status here.
        </p>
      </section>
    )
  }

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
          {/* A segment of 0% has no label: it would sit on top of its neighbour's. */}
          {segments.map((segment, index) => {
            if (segment.pct === 0) return null
            let style = {
              left: segment.key === 'low'
                ? `${centers[index] - segment.pct / 2}%`
                : `${centers[index]}%`,
            }
            // Two narrow neighbours (low and out) would overlap, so the low label moves to the left
            // of the out label, which is pinned to the right edge.
            if (segment.key === 'low' && outPct > 0 && lowPct < 8 && outPct < 8) {
              style = { left: 'auto', right: `calc(${outPct}% + 36px)`, transform: 'none' }
            }
            return (
              <span key={segment.key} className={`pct pct--${segment.key}`} style={style}>
                {segment.pct}%
              </span>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default DashboardInventoryOverview
