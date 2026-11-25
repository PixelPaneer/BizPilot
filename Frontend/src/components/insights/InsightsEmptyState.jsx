
export default function InsightsEmptyState({
  onRefresh,
  refreshing = false,
  insufficientHistory = false,
}) {
  return (
    <div className="insights-empty-state">
      <div className="insights-empty-icon">
        <span aria-hidden="true">✦</span>
      </div>

      <h3>
        {insufficientHistory
          ? 'More sales history needed'
          : 'No business insights available yet'}
      </h3>

      <p>
        {insufficientHistory
          ? 'More recorded sales are needed to identify reliable historical patterns. Customer enquiries are not counted as sales.'
          : 'There are currently no active insights for your business. New insights will appear here when the backend makes them available.'}
      </p>

      {onRefresh && (
        <button
          type="button"
          className="insights-button insights-button-primary"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh insights'}
        </button>
      )}
    </div>
  )
}
