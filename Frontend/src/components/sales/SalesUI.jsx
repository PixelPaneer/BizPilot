// Small building blocks shared by every card on the page.

export function Card({ className = '', style, children }) {
  return (
    <section
      style={style}
      className={`sales-card min-w-0 rounded-3xl border p-5 sm:p-7 ${className}`}
    >
      {children}
    </section>
  )
}

export function CardHeader({ title, subtitle, icon: Icon, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3.5">
        {Icon && (
          <span className="sales-card-header-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
          <h2 className="sales-heading text-lg font-semibold">{title}</h2>
          {subtitle && <p className="sales-muted mt-0.5 text-sm">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function ChartLegend({ items }) {
  return (
    <div className="sales-text mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className="inline-block w-7"
            style={{
              borderTopWidth: 2.5,
              borderTopStyle: item.dashed ? 'dashed' : 'solid',
              borderTopColor: item.color,
            }}
          />
          {item.label}
        </div>
      ))}
    </div>
  )
}