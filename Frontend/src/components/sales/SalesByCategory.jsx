import { useState } from 'react'
import { Layers } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { formatINR, formatNumber } from '../../utils/salesUtils'
import DateRangeFilter from './DateRangeFilter'
import { Card, CardHeader } from './SalesUI'
import { CATEGORY_COLORS, FALLBACK_COLOR } from './salesConstants'
import ViewToggle from './ViewToggle'

const METRICS = {
  revenue: {
    label: 'Revenue',
    field: 'revenue',
    subtitle: 'Revenue contribution across product categories.',
    centerLabel: 'Total Sales',
    format: formatINR,
  },
  units: {
    label: 'Units Sold',
    field: 'unitsSold',
    subtitle: 'Units sold across product categories.',
    centerLabel: 'Total Units',
    format: formatNumber,
  },
}

const METRIC_OPTIONS = Object.entries(METRICS).map(([value, m]) => ({ value, label: m.label }))

// Rounds the percentages so they always add up to exactly 100
function roundedShares(values) {
  const total = values.reduce((a, b) => a + b, 0)
  if (!total) return values.map(() => 0)
  const raw = values.map((v) => (v / total) * 100)
  const floors = raw.map(Math.floor)
  const remaining = 100 - floors.reduce((a, b) => a + b, 0)
  raw
    .map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac)
    .slice(0, remaining)
    .forEach(({ i }) => {
      floors[i] += 1
    })
  return floors
}

export default function SalesByCategory({ data, dateRange, onDateRangeChange }) {
  const [metricKey, setMetricKey] = useState('revenue') // revenue is the default
  const [activeIndex, setActiveIndex] = useState(null)
  const metric = METRICS[metricKey]

  const sorted = [...data].sort((a, b) => b[metric.field] - a[metric.field])
  const total = sorted.reduce((sum, item) => sum + item[metric.field], 0)
  const shares = roundedShares(sorted.map((item) => item[metric.field]))
  const slices = sorted.map((item, i) => ({
    name: item.category,
    value: item[metric.field],
    percentage: shares[i],
    color: CATEGORY_COLORS[item.category] ?? FALLBACK_COLOR,
  }))
  const active = activeIndex !== null ? slices[activeIndex] : null
  const maxPercentage = Math.max(...shares, 1)

  return (
    <Card className="relative sm:p-8">
      <CardHeader
        icon={Layers}
        title="Sales by Category"
        subtitle={metric.subtitle}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ViewToggle
              value={metricKey}
              options={METRIC_OPTIONS}
              onChange={(value) => {
                setMetricKey(value)
                setActiveIndex(null)
              }}
            />
            <DateRangeFilter
              value={dateRange}
              onChange={(next) => {
                setActiveIndex(null)
                onDateRangeChange(next)
              }}
            />
          </div>
        }
      />

      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] lg:gap-16">
        {/* Donut */}
        <div className="relative mx-auto h-[300px] w-full max-w-[420px] sm:h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius="66%"
                outerRadius="94%"
                paddingAngle={3}
                cornerRadius={8}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                animationDuration={800}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {slices.map((slice, i) => (
                  <Cell
                    key={slice.name}
                    fill={slice.color}
                    fillOpacity={activeIndex === null || activeIndex === i ? 1 : 0.28}
                    style={{ transition: 'fill-opacity 200ms ease', outline: 'none', cursor: 'pointer' }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-16 text-center">
            {active ? (
              <>
                <span className="sales-muted text-sm font-medium">{active.name}</span>
                <span className="sales-accent mt-1 text-2xl font-bold sm:text-3xl">
                  {metric.format(active.value)}
                </span>
                <span className="sales-muted mt-1 text-sm">{active.percentage}% of total</span>
              </>
            ) : (
              <>
                <span className="sales-accent text-2xl font-bold sm:text-3xl">
                  {metric.format(total)}
                </span>
                <span className="sales-muted mt-1 text-sm">{metric.centerLabel}</span>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <ul className="mx-auto w-full max-w-md lg:mx-0" onMouseLeave={() => setActiveIndex(null)}>
          {slices.map((slice, i) => (
            <li
              key={slice.name}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-default rounded-2xl px-3 py-3 transition-all ${
                activeIndex === i ? 'sales-legend-active' : ''
              } ${activeIndex !== null && activeIndex !== i ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="sales-heading flex-1 text-[15px] font-medium">{slice.name}</span>
                <span className="sales-muted text-sm tabular-nums">{metric.format(slice.value)}</span>
                <span className="sales-heading w-11 text-right text-[15px] font-semibold tabular-nums">
                  {slice.percentage}%
                </span>
              </div>
              <div className="sales-progress-track ml-6 mt-2 h-1.5 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(slice.percentage / maxPercentage) * 100}%`,
                    backgroundColor: slice.color,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}