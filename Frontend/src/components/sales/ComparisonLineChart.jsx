import { useId } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompactINR, formatINR } from '../../utils/salesUtils'
import { ChartLegend } from './SalesUI'

const GREEN = 'var(--sales-chart-current)'
const PEACH = 'var(--sales-chart-previous)'
const GRID = 'var(--sales-chart-grid)'
const AXIS_TEXT = 'var(--sales-muted)'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  // The soft fill under the line is not a real series, so skip it.
  // Real series have a friendly name; the fill only has the raw data key.
  const rows = payload.filter((item) => item.name && item.name !== item.dataKey)
  if (!rows.length) return null

  return (
    <div className="sales-tooltip min-w-[170px] rounded-xl border px-3.5 py-3 text-sm">
      <p className="sales-muted mb-2 text-xs font-medium">{label}</p>
      {rows.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-6 py-0.5">
          <span className="sales-text flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
          <span className="sales-heading font-semibold tabular-nums">{formatINR(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

// One chart used by both Sales Trend and Revenue Analysis:
// solid dark-green line with a soft fill (current) + dashed peach line (previous).
export default function ComparisonLineChart({
  data,
  currentKey,
  previousKey,
  currentLabel,
  previousLabel,
  height = 340,
}) {
  const gradientId = `fill-${useId().replace(/:/g, '')}`
  const showDots = data.length <= 14

  return (
    <div>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GREEN} stopOpacity={0.22} />
                <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="period"
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickMargin={10}
              minTickGap={24}
            />
            <YAxis
              domain={[0, 'auto']}
              tickLine={false}
              axisLine={false}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickFormatter={formatCompactINR}
              width={64}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--sales-chart-cursor)', strokeDasharray: '4 4' }} />
            <Area
              type="monotone"
              dataKey={currentKey}
              stroke="none"
              fill={`url(#${gradientId})`}
              activeDot={false}
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey={previousKey}
              name={previousLabel}
              stroke={PEACH}
              strokeWidth={2}
              strokeDasharray="6 5"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey={currentKey}
              name={currentLabel}
              stroke={GREEN}
              strokeWidth={2.75}
              dot={showDots ? { r: 3.5, fill: GREEN, strokeWidth: 0 } : false}
              activeDot={{ r: 6, fill: GREEN, stroke: 'var(--sales-surface)', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={[
          { label: currentLabel, color: GREEN },
          { label: previousLabel, color: PEACH, dashed: true },
        ]}
      />
    </div>
  )
}