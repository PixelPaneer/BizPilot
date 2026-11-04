import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { toPercent } from '../utils/inventoryUtils'

// "Inventory Overview" card: segmented stock-status bar with percentages.
export default function InventorySummary({ stats }) {
  const inPct = toPercent(stats.inStock, stats.total)
  const lowPct = toPercent(stats.low, stats.total)
  const outPct = Math.max(0, 100 - inPct - lowPct)

  const segments = [
    { key: 'in', pct: inPct, className: 'seg--in' },
    { key: 'low', pct: lowPct, className: 'seg--low' },
    { key: 'out', pct: outPct, className: 'seg--out' },
  ]
  // Center of each segment (in %) so its label sits right under it.
  let start = 0
  const centers = segments.map((s) => {
    const c = start + s.pct / 2
    start += s.pct
    return c
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
        <div className="stock-bar" role="img" aria-label={`${inPct}% in stock, ${lowPct}% low, ${outPct}% out of stock`}>
          {segments.map((s) => (
            <div key={s.key} className={`stock-bar__seg ${s.className}`} style={{ flexGrow: s.pct, flexBasis: 0 }} />
          ))}
        </div>
        <div className="stock-bar__labels">
          {segments.map((s, i) => (
            <span key={s.key} className={`pct pct--${s.key}`} style={{ left: s.key === 'low' ? `${centers[i] - s.pct / 2}%` : `${centers[i]}%` }}>
              {s.pct}%
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
