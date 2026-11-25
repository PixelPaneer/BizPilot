
import InsightCard from './InsightCard'

export default function MarketOpportunityCard({
  insight,
  onDismiss,
  onAct,
  busy,
}) {
  const category = insight.category || insight.productCategory
  const region = insight.region || insight.geographicalRegion
  const sourceName = insight.sourceName
  const sourceDate = insight.sourceDate

  const sourceType = insight.sourceType || insight.source

  const isCrossBusiness =
    sourceType === 'AGGREGATED' || insight.crossBusiness === true

  if (isCrossBusiness) {
    return (
      <div className="insight-card">
        <h3>Aggregated opportunity</h3>
        <p>
          Cross-business benchmarking is not displayed until the required
          privacy and consent safeguards are implemented.
        </p>
      </div>
    )
  }

  return (
    <InsightCard
      insight={insight}
      onDismiss={onDismiss}
      onAct={onAct}
      busy={busy}
    >
      <div className="insight-detail-grid">
        {category && (
          <div className="insight-detail">
            <span>Business / product category</span>
            <strong>{category}</strong>
          </div>
        )}

        {region && (
          <div className="insight-detail">
            <span>Geographical region</span>
            <strong>{region}</strong>
          </div>
        )}

        {sourceName && (
          <div className="insight-detail">
            <span>Research source</span>
            <strong>{sourceName}</strong>
          </div>
        )}

        {sourceDate && (
          <div className="insight-detail">
            <span>Source date</span>
            <strong>{sourceDate}</strong>
          </div>
        )}
      </div>

      {insight.opportunity && (
        <div className="insight-recommendation">
          <strong>Opportunity</strong>
          <p>{insight.opportunity}</p>
        </div>
      )}

      {insight.recommendation && (
        <div className="insight-recommendation">
          <strong>Suggested action</strong>
          <p>{insight.recommendation}</p>
        </div>
      )}
    </InsightCard>
  )
}
