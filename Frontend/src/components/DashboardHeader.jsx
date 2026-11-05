import { useRef, useState } from 'react'
import { Bell, Calendar, ChevronDown, Menu } from 'lucide-react'
import BrandLogo from './BrandLogo'
import ProfileMenu from './ProfileMenu'
import user from '../data/user'
import useClickOutside from '../utils/useClickOutside'
import { getGreeting } from '../utils/inventoryUtils'

const periods = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
]

function DashboardHeader({
  onToggleSidebar,
  sidebarOpen,
  period,
  onPeriodChange,
  alertCount,
  onOpenAlerts,
  onSignOut,
}) {
  const [periodOpen, setPeriodOpen] = useState(false)
  const [showEmptyNotifications, setShowEmptyNotifications] = useState(false)
  const periodRef = useRef(null)
  const notificationRef = useRef(null)
  useClickOutside(periodRef, () => setPeriodOpen(false))
  useClickOutside(notificationRef, () => setShowEmptyNotifications(false))
  const current = periods.find((item) => item.value === period) ?? periods[1]

  function handleNotificationsClick() {
    if (alertCount > 0) {
      setShowEmptyNotifications(false)
      onOpenAlerts()
      return
    }

    setShowEmptyNotifications((open) => !open)
  }

  return (
    <header className="header header-divider">
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
      <BrandLogo />
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
        <div className="relative" ref={notificationRef}>
          <button
            className="icon-btn bell"
            type="button"
            aria-label={
              alertCount > 0
                ? `Stock alerts: ${alertCount} products need attention`
                : 'Notifications: no alerts'
            }
            aria-expanded={showEmptyNotifications}
            onClick={handleNotificationsClick}
          >
            <Bell size={20} />
            {alertCount > 0 && <span className="bell__dot" />}
          </button>
          {showEmptyNotifications && (
            <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-line bg-white p-4 text-center text-sm text-muted shadow-lg">
              You're all caught up. No stock alerts.
            </div>
          )}
        </div>
        <ProfileMenu onSignOut={onSignOut} />
      </div>
    </header>
  )
}

export default DashboardHeader
