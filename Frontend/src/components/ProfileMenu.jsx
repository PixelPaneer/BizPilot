import { useRef, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
<<<<<<< origin/Frontend_v2
import { useProfile } from '../context/contextValues'
import { useClickOutside } from '../utils/useClickOutside'

// There is one kind of account: the owner of the shop.
const ROLE_LABEL = 'Business Owner'

=======
import { currentUser } from '../data/user'
import { useClickOutside } from '../utils/useClickOutside'

>>>>>>> origin/frontend-insights-anwesha
function getInitials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function ProfileMenu({ onSignOut }) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)
<<<<<<< origin/Frontend_v2
  const { profile } = useProfile()
  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : ''
  const initials = name ? getInitials(name) : '·'
=======
  const initials = getInitials(currentUser.name)
>>>>>>> origin/frontend-insights-anwesha
  useClickOutside(menuRef, () => setIsOpen(false))

  function handleSignOut() {
    setIsOpen(false)
    onSignOut()
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Open profile menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
<<<<<<< origin/Frontend_v2
        className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-white p-1 transition-colors hover:bg-sage-light md:py-1 md:pl-1 md:pr-2.5 xl:gap-2.5 xl:rounded-2xl xl:py-1.5 xl:pl-1.5 xl:pr-3"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white xl:h-9 xl:w-9">
          {initials}
        </span>
        <span className="hidden max-w-36 text-left md:block">
          <span className="block truncate text-[0.8rem] font-semibold leading-tight text-ink xl:text-sm">
            {name || '...'}
          </span>
          <span className="hidden text-xs leading-tight text-muted xl:block">{ROLE_LABEL}</span>
=======
        className="flex items-center gap-2.5 rounded-2xl border border-line bg-white p-1 transition-colors hover:bg-sage-light md:py-1.5 md:pl-1.5 md:pr-3"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white">
          {initials}
        </span>
        <span className="hidden text-left md:block">
          <span className="block text-sm font-semibold leading-tight text-ink">{currentUser.name}</span>
          <span className="block text-xs leading-tight text-muted">{currentUser.role}</span>
>>>>>>> origin/frontend-insights-anwesha
        </span>
        <ChevronDown size={16} aria-hidden="true" className="hidden text-muted md:block" />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-line bg-white p-5 shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-forest text-xl font-semibold text-white">
              {initials}
            </div>
<<<<<<< origin/Frontend_v2
            <p className="mt-3 font-semibold text-ink">{name || '...'}</p>
            <p className="text-sm text-muted">{ROLE_LABEL}</p>
            {profile?.businessName && <p className="text-sm text-muted">{profile.businessName}</p>}
            {profile?.email && <p className="text-sm text-muted">{profile.email}</p>}
=======
            <p className="mt-3 font-semibold text-ink">{currentUser.name}</p>
            <p className="text-sm text-muted">{currentUser.role}</p>
            <p className="text-sm text-muted">{currentUser.email}</p>
>>>>>>> origin/frontend-insights-anwesha
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-line py-2 text-sm font-medium text-ink transition-colors hover:bg-sage-light"
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default ProfileMenu
