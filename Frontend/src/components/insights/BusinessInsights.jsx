import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getInsights,
  sendInsightInteraction,
  refreshInsights,
} from '../../utils/insightsApi'

import InsightCard from './InsightCard'
import SeasonalInsightCard from './SeasonalInsightCard'
import HistoricalInsightCard from './HistoricalInsightCard'
import MarketOpportunityCard from './MarketOpportunityCard'
import InsightsEmptyState from './InsightsEmptyState'
import './insights.css'

const GROUPS = [
  {
    type: 'SEASONAL',
    label: 'SEASONAL TRENDS',
    title: 'Festival ready?',
    description:
      'Explore seasonal patterns, festivals and recurring demand.',
    action: 'Explore insights',
    className: 'insight-banner-seasonal',
  },
  {
    type: 'HISTORICAL',
    label: 'HISTORICAL INSIGHTS',
    title: 'Learn from your sales history',
    description:
      'Understand patterns from your previous sales and transactions.',
    action: 'View insights',
    className: 'insight-banner-historical',
  },
  {
    type: 'COLD_START',
    label: 'MARKET OPPORTUNITIES',
    title: "What's trending?",
    description:
      'Discover potential opportunities from available market information.',
    action: 'Discover',
    className: 'insight-banner-discover',
  },
]

function extractInsights(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.insights)) return response.insights
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.insights)) {
    return response.data.insights
  }

  return []
}

function getType(insight) {
  return String(
    insight?.type || insight?.insightType || ''
  ).toUpperCase()
}

function isInsufficientHistory(insights) {
  return insights.some(
    (item) =>
      item.insufficientHistory === true ||
      item.dataSufficient === false
  )
}

function InsightRenderer({ insight, onDismiss, onAct, busy }) {
  const props = { insight, onDismiss, onAct, busy }

  switch (getType(insight)) {
    case 'SEASONAL':
      return <SeasonalInsightCard {...props} />

    case 'HISTORICAL':
      return <HistoricalInsightCard {...props} />

    case 'COLD_START':
      return <MarketOpportunityCard {...props} />

    default:
      return <InsightCard {...props} />
  }
}

export default function BusinessInsights() {
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [busyIds, setBusyIds] = useState([])
  const [selectedType, setSelectedType] = useState(null)

  // Used to scroll smoothly to the expanded insight section.
  const detailsPanelRef = useRef(null)

  const loadInsights = useCallback(async () => {
    setError('')

    try {
      const response = await getInsights({ status: 'ACTIVE' })
      setInsights(extractInsights(response))
    } catch (err) {
      setError(err.message || 'Unable to load business insights.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInsights()
  }, [loadInsights])

  // Automatically scroll to the opened category.
  useEffect(() => {
    if (selectedType && detailsPanelRef.current) {
      detailsPanelRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [selectedType])

  const handleRefresh = async () => {
    if (refreshing || loading) return

    setRefreshing(true)
    setError('')

    try {
      await refreshInsights()
      setSelectedType(null)
      await loadInsights()
    } catch (err) {
      setError(err.message || 'Unable to refresh insights.')
    } finally {
      setRefreshing(false)
    }
  }

  const handleInteraction = async (id, interaction) => {
    if (!id || busyIds.includes(id)) return

    setBusyIds((current) => [...current, id])

    try {
      await sendInsightInteraction(id, interaction)

      if (interaction === 'DISMISSED') {
        setInsights((current) =>
          current.filter((item) => item.id !== id)
        )
      } else if (interaction === 'ACTED') {
        setInsights((current) =>
          current.map((item) =>
            item.id === id
              ? { ...item, status: 'ACTED' }
              : item
          )
        )
      }
    } catch (err) {
      setError(err.message || 'Unable to update this insight.')
    } finally {
      setBusyIds((current) =>
        current.filter((itemId) => itemId !== id)
      )
    }
  }

  const insufficient = isInsufficientHistory(insights)

  const selectedGroup = GROUPS.find(
    (group) => group.type === selectedType
  )

  const selectedInsights = selectedType
    ? insights.filter((item) => getType(item) === selectedType)
    : []

  return (
    <section className="business-insights-section">
      {/* Header */}
      <div className="business-insights-header">
        <div>
          <span className="insights-eyebrow">
            AI-POWERED ANALYSIS
          </span>

          <h2>Your Business Insights</h2>

          <p>
            Understand your business better with actionable insights
            based on available data.
          </p>
        </div>

        <button
          type="button"
          className="insights-button insights-button-primary"
          onClick={handleRefresh}
          disabled={refreshing || loading}
        >
          {refreshing ? (
            <>
              <span className="insights-spinner" />
              Refreshing...
            </>
          ) : (
            '↻ Refresh insights'
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="insights-error" role="alert">
          <p>{error}</p>

          <button
            type="button"
            className="insights-button insights-button-secondary"
            onClick={loadInsights}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div
          className="insights-banner-loading"
          aria-label="Loading insights"
        >
          {GROUPS.map((group) => (
            <div
              className="insight-banner-skeleton"
              key={group.type}
            />
          ))}
        </div>
      ) : insights.length === 0 ? (
        /* Empty state */
        <InsightsEmptyState
          onRefresh={handleRefresh}
          refreshing={refreshing}
          insufficientHistory={insufficient}
        />
      ) : (
        <>
          {/* Category banners */}
          <div className="insights-banner-row">
            {GROUPS.map((group) => {
              const groupInsights = insights.filter(
                (item) => getType(item) === group.type
              )

              if (!groupInsights.length) return null

              const isSelected = selectedType === group.type

              return (
                <button
                  type="button"
                  key={group.type}
                  className={`insight-banner ${group.className} ${
                    isSelected ? 'insight-banner-selected' : ''
                  }`}
                  onClick={() =>
                    setSelectedType(
                      isSelected ? null : group.type
                    )
                  }
                  aria-expanded={isSelected}
                  aria-pressed={isSelected}
                >
                  <span className="insight-banner-label">
                    {group.label}
                  </span>

                  <span className="insight-banner-title">
                    {group.title}
                  </span>

                  <span className="insight-banner-description">
                    {group.description}
                  </span>

                  <span className="insight-banner-footer">
                    <span>{group.action} →</span>

                    <span className="insight-banner-count">
                      {groupInsights.length}{' '}
                      {groupInsights.length === 1
                        ? 'insight'
                        : 'insights'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Expanded category details */}
          {selectedType && (
            <div
              className="insight-details-panel"
              ref={detailsPanelRef}
              aria-live="polite"
            >
              <div className="insight-details-heading">
                <div>
                  <span className="insights-eyebrow">
                    {selectedGroup?.label}
                  </span>

                  <h3>{selectedGroup?.title}</h3>

                  <p className="insight-details-description">
                    {selectedGroup?.description}
                  </p>
                </div>

                <button
                  type="button"
                  className="insight-close-button"
                  onClick={() => setSelectedType(null)}
                  aria-label="Close insight details"
                  title="Close insights"
                >
                  ✕
                </button>
              </div>

              {selectedInsights.length > 0 ? (
                <div className="business-insights-grid">
                  {selectedInsights.map((insight) => (
                    <InsightRenderer
                      key={insight.id}
                      insight={insight}
                      busy={busyIds.includes(insight.id)}
                      onDismiss={() =>
                        handleInteraction(
                          insight.id,
                          'DISMISSED'
                        )
                      }
                      onAct={() =>
                        handleInteraction(insight.id, 'ACTED')
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="insight-no-results">
                  There are no active insights in this category
                  right now.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}