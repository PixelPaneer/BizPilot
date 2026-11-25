import { resolveDateRange } from '../../utils/salesUtils'
import DateRangeFilter from './DateRangeFilter'

const formatDay = (date) =>
  date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export default function SalesInsightsHeader({ dateRange, onDateRangeChange }) {
  const { start, end, days } = resolveDateRange(dateRange)

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
<<<<<<< origin/Frontend_v2
        <h1 className="sales-heading text-2xl font-semibold tracking-tight sm:text-[30px]">
          Sales &amp; Business Insights
        </h1>
        <p className="sales-muted mt-1">
          Track your business performance and make better decisions.
        </p>
        <p className="sales-date-badge mt-3 inline-flex flex-wrap items-center gap-x-2 rounded-full px-3 py-1 text-xs font-medium">
          <span>
            {formatDay(start)} – {formatDay(end)} {end.getFullYear()}
          </span>
          <span aria-hidden="true">•</span>
=======
        <h1 className="text-2xl font-semibold tracking-tight text-[#1F2D27] sm:text-[30px]">
          Sales &amp; Business Insights
        </h1>
        <p className="mt-1 text-[#7A8079]">
          Track your business performance and make better decisions.
        </p>
        <p className="mt-3 inline-flex flex-wrap items-center gap-x-2 rounded-full bg-[#E8EFE6] px-3 py-1 text-xs font-medium text-[#244F3D]">
          <span>
            {formatDay(start)} – {formatDay(end)} {end.getFullYear()}
          </span>
          <span className="text-[#244F3D]/50">•</span>
>>>>>>> origin/frontend-insights-anwesha
          <span>compared with the previous {days} {days === 1 ? 'day' : 'days'}</span>
        </p>
      </div>
      <DateRangeFilter value={dateRange} onChange={onDateRangeChange} />
    </header>
  )
}