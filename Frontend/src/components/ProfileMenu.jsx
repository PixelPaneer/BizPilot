import { useRef, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import user from '../data/user'
import useClickOutside from '../utils/useClickOutside'

export default function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false))

  return (
    <div className="dropdown" ref={ref}>
      <button className="profile-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="menu">
        <span className="avatar">{user.initials}</span>
        <span className="profile-btn__text">
          <strong>{user.name}</strong>
          <small>{user.role}</small>
        </span>
        <ChevronDown size={16} />
      </button>

      {open && (
        <ul className="dropdown__menu dropdown__menu--right" role="menu">
          <li>
            <button role="menuitem" onClick={() => setOpen(false)}>
              <LogOut size={15} /> Log out
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}