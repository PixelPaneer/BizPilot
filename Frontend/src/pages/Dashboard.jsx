import { useEffect, useState } from 'react'
import { IndianRupee } from 'lucide-react'
import SummaryCard from '../components/DashboardStatCard'
import InventorySummary from '../components/DashboardInventoryOverview'
import RecentActivity from '../components/RecentActivity'
import QuickActions from '../components/QuickActions'
import { fetchDashboard } from '../utils/api'
import { formatCurrency } from '../utils/inventoryUtils'

export default function Dashboard({ period }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchDashboard(period).then((d) => {
      if (!cancelled) setData(d)
    })
    return () => {
      cancelled = true
    }
  }, [period])

  if (!data) return <div className="loading">Loading your dashboard…</div>

  return (
    <div className="dashboard">
       {/* Row 1: Total Revenue | Inventory Overview */}
      <div className="dashboard__row">
        <SummaryCard
          icon={<IndianRupee size={26} strokeWidth={2.4} />}
          label="Total Revenue"
          value={formatCurrency(data.revenue.amount)}
          change={data.revenue.changePercent}
          changeLabel="vs previous period"
        />
        <InventorySummary stats={data.inventory} />
      </div>

      { /* Row 2: Quick Actions | Recent Activity */ }
      <div className="dashboard__row">
        <QuickActions />
        <RecentActivity activities={data.activities} />
      </div>
    </div>
  )
}
