import { useRef, useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { useClickOutside } from '../utils/useClickOutside'

const PERIODS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
]

// Chooses which period the dashboard figures cover. It belongs to the dashboard page, not to
// the header, which is the same on every page.
function PeriodSelect({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  useClickOutside(containerRef, () => setIsOpen(false))
  const current = PERIODS.find((item) => item.value === value) ?? PERIODS[1]

  return (
    <div className="dropdown" ref={containerRef}>
      <button
        type="button"
        className="period-btn"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Calendar size={16} />
        <span>{current.label}</span>
        <ChevronDown size={15} />
      </button>
      {isOpen && (
        <ul className="dropdown__menu dropdown__menu--right" role="listbox">
          {PERIODS.map((item) => (
            <li key={item.value}>
              <button
                type="button"
                role="option"
                aria-selected={item.value === value}
                className={item.value === value ? 'is-selected' : ''}
                onClick={() => {
                  onChange(item.value)
                  setIsOpen(false)
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default PeriodSelect
