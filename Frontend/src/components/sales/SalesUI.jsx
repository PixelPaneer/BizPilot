// Small building blocks shared by every card on the page.

export function Card({ className = '', style, children }) {
  return (
    <section
      style={style}
<<<<<<< origin/Frontend_v2
      className={`sales-card min-w-0 rounded-3xl border p-5 sm:p-7 ${className}`}
=======
      className={`min-w-0 rounded-3xl border border-[#EAE4D8] bg-white p-5 shadow-[0_1px_2px_rgba(36,79,61,0.04),0_12px_32px_-16px_rgba(36,79,61,0.16)] sm:p-7 ${className}`}
>>>>>>> origin/frontend-insights-anwesha
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
<<<<<<< origin/Frontend_v2
          <span className="sales-card-header-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
=======
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8EFE6] text-[#244F3D]">
>>>>>>> origin/frontend-insights-anwesha
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
<<<<<<< origin/Frontend_v2
          <h2 className="sales-heading text-lg font-semibold">{title}</h2>
          {subtitle && <p className="sales-muted mt-0.5 text-sm">{subtitle}</p>}
=======
          <h2 className="text-lg font-semibold text-[#1F2D27]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-[#7A8079]">{subtitle}</p>}
>>>>>>> origin/frontend-insights-anwesha
        </div>
      </div>
      {action}
    </div>
  )
}

export function ChartLegend({ items }) {
  return (
<<<<<<< origin/Frontend_v2
    <div className="sales-text mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm">
=======
    <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-[#5E655F]">
>>>>>>> origin/frontend-insights-anwesha
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