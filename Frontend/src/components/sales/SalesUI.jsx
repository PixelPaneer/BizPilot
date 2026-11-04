// Small building blocks shared by every card on the page.

export const CATEGORY_COLORS = {
  Bakery: '#244F3D',
  Fruits: '#E6A18A',
  Dairy: '#E3B567',
  Snacks: '#8FB89E',
  Beverages: '#C9B8A3',
  Others: '#7C6A5C',
}
export const FALLBACK_COLOR = '#B9B2A5'

export function Card({ className = '', style, children }) {
  return (
    <section
      style={style}
      className={`min-w-0 rounded-3xl border border-[#EAE4D8] bg-white p-5 shadow-[0_1px_2px_rgba(36,79,61,0.04),0_12px_32px_-16px_rgba(36,79,61,0.16)] sm:p-7 ${className}`}
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
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8EFE6] text-[#244F3D]">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
          <h2 className="text-lg font-semibold text-[#1F2D27]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-[#7A8079]">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function ChartLegend({ items }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-[#5E655F]">
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