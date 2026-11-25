
import InsightCard from './InsightCard'

export default function SeasonalInsightCard({
  insight,
  onDismiss,
  onAct,
  busy,
}) {
  const event = insight.event || {}
  const products = insight.matchedProducts || insight.products || []

  return (
    <InsightCard
      insight={insight}
      onDismiss={onDismiss}
      onAct={onAct}
      busy={busy}
    >
      <div className="insight-detail-grid">
        {(event.name || insight.eventName) && (
          <div className="insight-detail">
            <span>Event / season</span>
            <strong>{event.name || insight.eventName}</strong>
          </div>
        )}

        {(event.startDate || insight.eventStartDate) && (
          <div className="insight-detail">
            <span>Event starts</span>
            <strong>{event.startDate || insight.eventStartDate}</strong>
          </div>
        )}

        {(event.endDate || insight.eventEndDate) && (
          <div className="insight-detail">
            <span>Event ends</span>
            <strong>{event.endDate || insight.eventEndDate}</strong>
          </div>
        )}
      </div>

      {products.length > 0 && (
        <div className="insight-products">
          <h4>Matched catalogue products</h4>

          {products.map((product, index) => (
            <div
              className="insight-product-row"
              key={product.id || product.productId || index}
            >
              <div>
                <strong>{product.name || product.productName || 'Product'}</strong>
                <span>
                  Current stock: {product.currentStock ?? product.stock ?? 'Not available'}
                </span>
                <span>
                  Reorder threshold: {product.reorderThreshold ?? 'Not available'}
                </span>
              </div>

              {(product.id || product.productId) && (
                <a
                  href={`/inventory?productId=${encodeURIComponent(
                    product.id || product.productId
                  )}`}
                  className="insight-link"
                >
                  View product
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {insight.recommendation && (
        <div className="insight-recommendation">
          <strong>Recommendation</strong>
          <p>{insight.recommendation}</p>
        </div>
      )}

      {insight.eventSource && (
        <p className="insight-source-detail">
          Event source: {insight.eventSource}
        </p>
      )}
    </InsightCard>
  )
}
