
const SOURCE_CONFIG = {
  HISTORICAL: {
    label: 'Historical data',
    className: 'insight-source-historical',
  },
  PUBLIC: {
    label: 'Public research',
    className: 'insight-source-public',
  },
  AGGREGATED: {
    label: 'Aggregated data',
    className: 'insight-source-aggregated',
  },
  HYBRID: {
    label: 'Combined sources',
    className: 'insight-source-hybrid',
  },
}

export default function InsightSourceBadge({ source }) {
  const config = SOURCE_CONFIG[source]

  if (!config) return null

  return (
    <span className={`insight-source-badge ${config.className}`}>
      {config.label}
    </span>
  )
}
