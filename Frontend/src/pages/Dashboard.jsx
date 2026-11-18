import { useEffect, useState } from 'react'
import { IndianRupee } from 'lucide-react'
import SummaryCard from '../components/DashboardStatCard'
import InventorySummary from '../components/DashboardInventoryOverview'
import RecentActivity from '../components/RecentActivity'
import QuickActions from '../components/QuickActions'
import PeriodSelect from '../components/PeriodSelect'
import { fetchDashboard } from '../utils/api'
import { formatCurrency } from '../utils/inventoryUtils'

export default function Dashboard({ period, onPeriodChange }) {
  // The result is stored with the request it belongs to, so a changed period (or a retry)
  // shows "loading" until its own answer arrives instead of showing the old numbers.
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  const requestKey = `${period}:${attempt}`

  useEffect(() => {
    let cancelled = false
    fetchDashboard(period)
      .then((data) => {
        if (!cancelled) setResult({ requestKey, data })
      })
      .catch((error) => {
        console.error('Unable to load the dashboard.', error)
        if (!cancelled) setResult({ requestKey, error: error.message })
      })
    return () => {
      cancelled = true
    }
  }, [period, attempt, requestKey])

  const toolbar = (
    // Below xl the selector sits beside the page heading (see App.jsx), so this one is hidden.
    <div className="mb-4 hidden justify-end xl:flex">
      <PeriodSelect value={period} onChange={onPeriodChange} />
    </div>
  )

  if (!result || result.requestKey !== requestKey) {
    return (
      <>
        {toolbar}
        <div className="loading">Loading your dashboard…</div>
      </>
    )
  }

  if (result.error) {
    return (
      <>
        {toolbar}
        <div className="loading" role="alert">
          <p>Could not load your dashboard: {result.error}</p>
          <button
            type="button"
            onClick={() => setAttempt((count) => count + 1)}
            className="mt-3 rounded-full bg-forest px-5 py-2 text-sm font-medium text-white hover:bg-deep"
          >
            Try again
          </button>
        </div>
      </>
    )
  }

  const { data } = result

  return (
    <div className="dashboard">
      {toolbar}
      {/* Row 1: Total Revenue | Inventory Overview */}
      <div className="dashboard__row dashboard__row--summary">
        <SummaryCard
          icon={<IndianRupee size={26} strokeWidth={2.4} />}
          label="Total Revenue"
          value={formatCurrency(data.revenue.amount)}
          change={data.revenue.changePercent}
          changeLabel="vs previous period"
        />
        <InventorySummary stats={data.inventory} />
      </div>

      {/* Row 2: Quick Actions | Recent Activity */}
      <div className="dashboard__row dashboard__row--detail">
        <QuickActions />
        <RecentActivity activities={data.activities} />
      </div>
    </div>
  )
}
