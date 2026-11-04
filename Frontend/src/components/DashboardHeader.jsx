import { useRef, useState } from 'react'
import { Bell, Calendar, ChevronDown, Menu } from 'lucide-react'
import ProfileMenu from './ProfileMenu'
import user from '../data/user'
import useClickOutside from '../utils/useClickOutside'
import { getGreeting } from '../utils/inventoryUtils'

const periods = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
]

function DashboardHeader({ onToggleSidebar, sidebarOpen, period, onPeriodChange, onSignOut }) {
  const [periodOpen, setPeriodOpen] = useState(false)
  const periodRef = useRef(null)
  useClickOutside(periodRef, () => setPeriodOpen(false))
  const current = periods.find((item) => item.value === period) ?? periods[1]

  return (
    <header className="header">
      <button
        className="icon-btn burger"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-expanded={sidebarOpen}
      >
        <Menu
          size={22}
          className={`transition-transform duration-300 ${sidebarOpen ? 'rotate-180' : ''}`}
        />
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
          <button
            className="period-btn"
            onClick={() => setPeriodOpen((open) => !open)}
            aria-haspopup="listbox"
          >
            <Calendar size={16} />
            <span>{current.label}</span>
            <ChevronDown size={15} />
          </button>
          {periodOpen && (
            <ul className="dropdown__menu" role="listbox">
              {periods.map((item) => (
                <li key={item.value}>
                  <button
                    role="option"
                    aria-selected={item.value === period}
                    className={item.value === period ? 'is-selected' : ''}
                    onClick={() => {
                      onPeriodChange(item.value)
                      setPeriodOpen(false)
                    }}
                  >
                    {item.label}
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
        <ProfileMenu onSignOut={onSignOut} />
      </div>
    </header>
  )
}

export default DashboardHeader
