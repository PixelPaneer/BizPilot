// The Daily / Weekly / Monthly pill switch, also reused for Revenue / Units Sold.

import { TIME_VIEWS } from './salesConstants'

export default function ViewToggle({ value, onChange, options = TIME_VIEWS }) {
  return (
<<<<<<< origin/Frontend_v2
    <div className="sales-view-toggle inline-flex rounded-xl p-1">
=======
    <div className="inline-flex rounded-xl bg-[#F3EFE6] p-1">
>>>>>>> origin/frontend-insights-anwesha
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
            value === option.value
<<<<<<< origin/Frontend_v2
              ? 'sales-view-active shadow-sm'
              : 'sales-view-inactive'
=======
              ? 'bg-[#244F3D] text-white shadow-sm'
              : 'text-[#5E655F] hover:text-[#1F2D27]'
>>>>>>> origin/frontend-insights-anwesha
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}