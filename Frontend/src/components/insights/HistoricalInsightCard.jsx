
import InsightCard from './InsightCard'

function formatNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = Number(value)

  if (!Number.isFinite(number)) {
    return null
  }

  return number.toLocaleString('en-IN')
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = Number(value)

  if (!Number.isFinite(number)) {
    return null
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(number)
}

function formatMemoryDate(value) {
  if (!value) return null

  // Handle YYYY-MM-DD without changing the calendar date.
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    const [year, month, day] = value.split('-').map(Number)

    const date = new Date(year, month - 1, day)

    // Reject invalid calendar dates.
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

export default function HistoricalInsightCard({
  insight,
  onDismiss,
  onAct,
  busy,
}) {
  // Only Business Memories fields are used here.
  // Period-comparison fields are deliberately ignored.

  const memoryDate = formatMemoryDate(insight.memoryDate)

  const revenue = formatCurrency(insight.revenue)

  const completedSales = formatNumber(
    insight.completedSalesCount
  )

  const unitsSold = formatNumber(insight.unitsSold)

  const topProducts = Array.isArray(insight.topProducts)
    ? insight.topProducts
    : []

  const highlights = Array.isArray(insight.highlights)
    ? insight.highlights
    : []

  const insufficientHistory =
    insight.insufficientHistory === true ||
    insight.dataSufficient === false

  // A valid memory must have an actual memory date.
  // This prevents old period-based insights from appearing here.
  const hasMemoryContent =
    Boolean(memoryDate) &&
    Boolean(
      revenue ||
      completedSales ||
      unitsSold ||
      insight.headline ||
      insight.story ||
      insight.takeaway ||
      topProducts.length > 0 ||
      highlights.length > 0
    )

  return (
    <InsightCard
      insight={insight}
      onDismiss={onDismiss}
      onAct={onAct}
      busy={busy}
    >
      {insufficientHistory || !hasMemoryContent ? (
        <div className="business-memory-empty">
          <div className="business-memory-icon">✦</div>

          <h4>Your business memories are still building</h4>

          <p>
            Your business memories are still building. Check back
            as you record more sales.
          </p>
        </div>
      ) : (
        <div className="business-memory-content">

          {/* Anniversary date */}
          <div className="business-memory-date">
            <span>ON THIS DAY IN YOUR BUSINESS</span>

            <strong>{memoryDate}</strong>

            {insight.nearbyDateUsed === true && (
              <small>
                Memory from a nearby date around this anniversary
              </small>
            )}
          </div>

          {/* Memory headline */}
          {insight.headline && (
            <h4 className="business-memory-headline">
              {insight.headline}
            </h4>
          )}

          {/* AI-generated memory story */}
          {insight.story && (
            <p className="business-memory-story">
              {insight.story}
            </p>
          )}

          {/* Actual historical statistics */}
          {(revenue || completedSales || unitsSold) && (
            <div className="business-memory-stats">

              {revenue && (
                <div className="business-memory-stat">
                  <span>Recorded revenue</span>
                  <strong>{revenue}</strong>
                </div>
              )}

              {completedSales && (
                <div className="business-memory-stat">
                  <span>Completed sales</span>
                  <strong>{completedSales}</strong>
                </div>
              )}

              {unitsSold && (
                <div className="business-memory-stat">
                  <span>Units sold</span>
                  <strong>{unitsSold}</strong>
                </div>
              )}

            </div>
          )}

          {/* Historical highlights */}
          {highlights.length > 0 && (
            <div className="business-memory-highlights">
              <h5>What happened that day</h5>

              {highlights.map((item, index) => (
                <div
                  className="business-memory-highlight"
                  key={item.id || index}
                >
                  {item.label && (
                    <strong>{item.label}</strong>
                  )}

                  {item.value !== null &&
                    item.value !== undefined && (
                      <span>{item.value}</span>
                    )}

                  {item.description && (
                    <p>{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Products sold on the memory date */}
          {topProducts.length > 0 && (
            <div className="business-memory-products">
              <h5>Products in this memory</h5>

              {topProducts.map((product, index) => {
                const name =
                  product.name || product.productName

                if (!name) return null

                const quantity = formatNumber(
                  product.unitsSold
                )

                return (
                  <div
                    className="business-memory-product"
                    key={product.id || index}
                  >
                    <span>{name}</span>

                    {quantity && (
                      <strong>
                        {quantity} units sold
                      </strong>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Business takeaway */}
          {insight.takeaway && (
            <div className="business-memory-takeaway">
              <span>YOUR BUSINESS TAKEAWAY</span>

              <p>{insight.takeaway}</p>
            </div>
          )}

          <a href="/analytics" className="insight-link">
            View Sales Insights charts →
          </a>

        </div>
      )}
    </InsightCard>
  )
}
