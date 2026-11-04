import { NavLink } from 'react-router-dom'
import { TrendingUp, Home, Package, Settings, CircleHelp  } from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/inventory', label: 'Inventory ', icon: Package },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp },
  { to: '/help', label: 'Help & Support', icon: CircleHelp },   // To be decided
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ open, onNavigate }) {
  return (
    <aside className="sidebar" aria-hidden={!open}>
      {/* <div className="sidebar__brand">
        <img src="/bizpilot-logo.png" alt="BizPilot – AI Business Assistant" />
      </div> */}

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
