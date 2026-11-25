
import InsightSourceBadge from './InsightSourceBadge'

function formatDate(value) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function InsightCard({
  insight,
  children,
  onDismiss,
  onAct,
  busy = false,
}) {
  const {
    title,
    summary,
    reasoning,
    confidence,
    priority,
    sourceType,
    source,
    startDate,
    endDate,
    status,
  } = insight

  const confidenceValue =
    typeof confidence === 'number'
      ? `${Math.round(confidence <= 1 ? confidence * 100 : confidence)}%`
      : confidence || null

  const dateLabel =
    startDate || endDate
      ? `${formatDate(startDate) || '—'} – ${formatDate(endDate) || '—'}`
      : null

  return (
    <article className="insight-card">
      <div className="insight-card-header">
        <div className="insight-card-heading">
          <h3>{title || 'Business insight'}</h3>
          {priority && (
            <span className={`insight-priority priority-${String(priority).toLowerCase()}`}>
              {priority} priority
            </span>
          )}
        </div>

        <InsightSourceBadge source={sourceType || source} />
      </div>

      {summary && <p className="insight-summary">{summary}</p>}

      {reasoning && (
        <div className="insight-reasoning">
          <strong>Why this matters</strong>
          <p>{reasoning}</p>
        </div>
      )}

      {children}

      <div className="insight-card-meta">
        {confidenceValue && (
          <span>
            Confidence: <strong>{confidenceValue}</strong>
          </span>
        )}

        {dateLabel && <span>Relevant period: {dateLabel}</span>}
      </div>

      {status && (
        <p className="insight-status">
          Status: {String(status).replaceAll('_', ' ')}
        </p>
      )}

      <div className="insight-card-actions">
        {onAct && (
          <button
            type="button"
            className="insights-button insights-button-primary"
            disabled={busy || status === 'ACTED'}
            onClick={onAct}
          >
            {status === 'ACTED' ? 'Marked as acted' : 'Mark as acted'}
          </button>
        )}

        {onDismiss && (
          <button
            type="button"
            className="insights-button insights-button-secondary"
            disabled={busy}
            onClick={onDismiss}
          >
            Dismiss
          </button>
        )}
      </div>

      <p className="insight-disclaimer">
        Recommendations are suggestions only. No inventory or product changes
        are made automatically.
      </p>
    </article>
  )
}
