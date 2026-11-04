// The Daily / Weekly / Monthly pill switch, also reused for Revenue / Units Sold.

export const TIME_VIEWS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export default function ViewToggle({ value, onChange, options = TIME_VIEWS }) {
  return (
    <div className="inline-flex rounded-xl bg-[#F3EFE6] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
            value === option.value
              ? 'bg-[#244F3D] text-white shadow-sm'
              : 'text-[#5E655F] hover:text-[#1F2D27]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}