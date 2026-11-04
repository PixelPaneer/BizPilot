import { useRef, useState } from 'react'
import { Bell, Menu } from 'lucide-react'
import BrandLogo from './BrandLogo'
import GlobalSearch from './GlobalSearch'
import ProfileMenu from './ProfileMenu'
import { useClickOutside } from '../utils/useClickOutside'

function NotificationBell({ count, onOpenAlerts }) {
  const [showEmpty, setShowEmpty] = useState(false)
  const bellRef = useRef(null)
  useClickOutside(bellRef, () => setShowEmpty(false))

  function handleClick() {
    if (count > 0) onOpenAlerts()
    else setShowEmpty((open) => !open)
  }

  return (
    <div className="relative" ref={bellRef}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={count > 0 ? `Stock alerts: ${count} products need attention` : 'Notifications: no alerts'}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-forest transition-colors hover:bg-sage-light"
      >
        <Bell size={18} aria-hidden="true" />
        {count > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-alert ring-2 ring-white" />
        )}
      </button>
      {showEmpty && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-line bg-white p-4 text-center text-sm text-muted shadow-lg">
          You're all caught up. No stock alerts.
        </div>
      )}
    </div>
  )
}

function Header({
  products,
  heading,
  alertCount,
  isMenuOpen,
  onMenuToggle,
  onNavigate,
  onSelectProduct,
  onOpenAlerts,
  onSignOut,
}) {
  return (
    <header className="sticky top-0 z-50 h-[4.5rem] border-b border-line bg-paper">
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMenuOpen}
          aria-controls="main-navigation"
          onClick={onMenuToggle}
          className="burger flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink transition-colors hover:bg-sage-light"
        >
          <Menu
            size={20}
            aria-hidden="true"
            className={`transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`}
          />
        </button>
        <BrandLogo />
        <div className="ml-3 hidden min-w-0 xl:block">
          <h1 className="truncate text-xl font-bold text-ink">{heading.title}</h1>
          <p className="truncate text-sm text-muted">{heading.subtitle}</p>
        </div>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
          <GlobalSearch
            products={products}
            onNavigate={onNavigate}
            onSelectProduct={onSelectProduct}
          />
          <div className="hidden min-[420px]:block">
            <NotificationBell count={alertCount} onOpenAlerts={onOpenAlerts} />
          </div>
          <ProfileMenu onSignOut={onSignOut} />
        </div>
      </div>
    </header>
  )
}

export default Header
