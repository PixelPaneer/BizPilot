import { useEffect } from 'react'
import { pages } from '../data/pages'

function Sidebar({ activePage, onNavigate, isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 top-[var(--header-h)] z-30 bg-ink/10"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        id="main-navigation"
        aria-label="Main navigation"
        className={`fixed left-0 top-[var(--header-h)] z-40 h-[calc(100dvh-var(--header-h))] w-64 overflow-y-auto border-r border-line bg-paper p-3 shadow-xl transition-[transform,visibility] duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full invisible'
        }`}
      >
        <nav className="space-y-1">
          {pages.map((page) => {
            const Icon = page.icon
            const isActive = page.id === activePage
            return (
              <button
                key={page.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onNavigate(page.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[0.95rem] font-semibold transition-colors ${
                  isActive ? 'bg-sage-light text-forest' : 'text-ink hover:bg-sage-light/60'
                }`}
              >
                <Icon
                  size={19}
                  aria-hidden="true"
                  className={isActive ? 'text-forest' : 'text-muted'}
                />
                {page.label}
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

export default Sidebar
