import { ArrowUp } from 'lucide-react'

// Top stat card (icon + label + value + growth line).
export default function SummaryCard({ icon, label, value, change, changeLabel }) {
  return (
    <div className="summary-card">
      <div className="summary-card__icon">{icon}</div>
      <div className="summary-card__body">
        <span className="summary-card__label">{label}</span>
        <strong className="summary-card__value">{value}</strong>
        {change !== undefined && (
          <span className="summary-card__change">
            <ArrowUp size={14} strokeWidth={2.6} />
            <b>{change}%</b> {changeLabel}
          </span>
        )}
      </div>
    </div>
  )
}
