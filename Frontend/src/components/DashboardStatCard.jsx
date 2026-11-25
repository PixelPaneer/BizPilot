<<<<<<< origin/Frontend_v2
import { ArrowDown, ArrowUp } from 'lucide-react'
=======
import { ArrowUp } from 'lucide-react'
>>>>>>> origin/frontend-insights-anwesha

function DashboardStatCard({ icon, label, value, change, changeLabel }) {
  return (
    <div className="summary-card">
      <div className="summary-card__icon">{icon}</div>
      <div className="summary-card__body">
        <span className="summary-card__label">{label}</span>
        <strong className="summary-card__value">{value}</strong>
<<<<<<< origin/Frontend_v2
        {change === null && (
          <span className="summary-card__change summary-card__change--none">
            No sales in the previous period to compare
          </span>
        )}
        {typeof change === 'number' && (
          <span className={`summary-card__change ${change < 0 ? 'summary-card__change--down' : ''}`}>
            {change < 0 ? (
              <ArrowDown size={14} strokeWidth={2.6} />
            ) : (
              <ArrowUp size={14} strokeWidth={2.6} />
            )}
            <b>
              {change > 0 ? '+' : change < 0 ? '-' : ''}
              {Math.abs(change)}%
            </b>{' '}
            {changeLabel}
=======
        {change !== undefined && (
          <span className="summary-card__change">
            <ArrowUp size={14} strokeWidth={2.6} />
            <b>{change}%</b> {changeLabel}
>>>>>>> origin/frontend-insights-anwesha
          </span>
        )}
      </div>
    </div>
  )
}

export default DashboardStatCard
