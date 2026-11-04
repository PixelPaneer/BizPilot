const iconStyles = {
  sage: 'bg-sage-light text-forest',
  amber: 'bg-warn-bg text-warn-text',
  red: 'bg-danger-bg text-danger-text',
}

function SummaryCard({ label, value, icon: Icon, tone = 'sage' }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
      </div>
      <div className={`flex h-11 w-11 items-center justify-center rounded-full ${iconStyles[tone]}`}>
        <Icon size={22} aria-hidden="true" />
      </div>
    </div>
  )
}

export default SummaryCard