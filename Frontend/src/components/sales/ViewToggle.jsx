// The Daily / Weekly / Monthly pill switch, also reused for Revenue / Units Sold.

import { TIME_VIEWS } from './salesConstants'

export default function ViewToggle({ value, onChange, options = TIME_VIEWS }) {
  return (
    <div className="sales-view-toggle inline-flex rounded-xl p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
            value === option.value
              ? 'sales-view-active shadow-sm'
              : 'sales-view-inactive'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}