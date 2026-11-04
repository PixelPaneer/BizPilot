import { useRef, useState } from 'react'
import { Bell, Calendar, ChevronDown, Menu} from 'lucide-react'
import ProfileMenu from './ProfileMenu'
import user from '../data/user'
import useClickOutside from '../utils/useClickOutside'
import { getGreeting } from '../utils/inventoryUtils'

const PERIODS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
]

export default function Header({ onToggleSidebar, sidebarOpen, period, onPeriodChange }) {
  const [periodOpen, setPeriodOpen] = useState(false)
  const periodRef = useRef(null)
  useClickOutside(periodRef, () => setPeriodOpen(false))

  const current = PERIODS.find((p) => p.value === period) || PERIODS[1]

  return (
    <header className="header">
      <button
        className="icon-btn burger"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-expanded={sidebarOpen}
      >
        {/* {sidebarOpen ? <X size={22} /> : <Menu size={22} />} */}
        <Menu size={22} />
      </button>

      <img className="header__logo" src="/bizpilot-logo.png" alt="BizPilot – AI Business Assistant" />

      <div className="header__greeting">
        <h1>
          {getGreeting()}, {user.name} 
          <span className="wave" aria-hidden="true">👋</span>  
        </h1>
        <p>Here's your business overview for today.</p>
      </div>

      <div className="header__actions">
        <div className="dropdown" ref={periodRef}>
          <button className="period-btn" onClick={() => setPeriodOpen((v) => !v)} aria-haspopup="listbox">
            <Calendar size={16} />
            <span>{current.label}</span>
            <ChevronDown size={15} />
          </button>
          {periodOpen && (
            <ul className="dropdown__menu" role="listbox">
              {PERIODS.map((p) => (
                <li key={p.value}>
                  <button
                    role="option"
                    aria-selected={p.value === period}
                    className={p.value === period ? 'is-selected' : ''}
                    onClick={() => {
                      onPeriodChange(p.value)
                      setPeriodOpen(false)
                    }}
                  >
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button className="icon-btn bell" aria-label="Notifications">
          <Bell size={20} />
          <span className="bell__dot" />
        </button>

        <ProfileMenu />
      </div>
    </header>
  )
}
