import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import ComparisonLineChart from './ComparisonLineChart'
import { Card, CardHeader } from './SalesUI'
import ViewToggle from './ViewToggle'

export default function SalesTrend({ data }) {
  const [view, setView] = useState('daily')

  return (
    <Card>
      <CardHeader
        icon={TrendingUp}
        title="Sales Trend"
        subtitle="Sales performance over time."
        action={<ViewToggle value={view} onChange={setView} />}
      />
      <ComparisonLineChart
        data={data[view]}
        currentKey="currentPeriodSales"
        previousKey="previousPeriodSales"
        currentLabel="Current Period"
        previousLabel="Previous Period"
      />
    </Card>
  )
}