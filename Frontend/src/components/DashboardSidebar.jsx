import { NavLink } from 'react-router-dom'
import { CircleHelp, Home, Package, Settings, TrendingUp } from 'lucide-react'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: Home, end: true },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp },
  { to: '/help', label: 'Help & Support', icon: CircleHelp },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function DashboardSidebar({ open, onNavigate }) {
  return (
    <aside className="sidebar" aria-hidden={!open}>
      <nav className="sidebar__nav">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            tabIndex={open ? 0 : -1}
            onClick={onNavigate}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
          >
            <Icon size={19} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default DashboardSidebar
