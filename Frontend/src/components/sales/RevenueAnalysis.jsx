import { useState } from 'react'
import { IndianRupee } from 'lucide-react'
import ComparisonLineChart from './ComparisonLineChart'
import { Card, CardHeader } from './SalesUI'
import ViewToggle from './ViewToggle'

export default function RevenueAnalysis({ data }) {
  const [view, setView] = useState('daily')

  return (
    <Card>
      <CardHeader
        icon={IndianRupee}
        title="Revenue Analysis"
        subtitle="Revenue comparison over time."
        action={<ViewToggle value={view} onChange={setView} />}
      />
      <ComparisonLineChart
        data={data[view]}
        currentKey="selectedPeriodRevenue"
        previousKey="previousPeriodRevenue"
        currentLabel="Selected Period"
        previousLabel="Previous Period"
      />
    </Card>
  )
}