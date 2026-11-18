import { useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { pages } from '../data/pages'
import { useClickOutside } from '../utils/useClickOutside'
import { getCategoryEmoji } from '../utils/inventoryUtils'

const MAX_PRODUCT_RESULTS = 5

function GlobalSearch({ products, onNavigate, onSelectProduct }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useClickOutside(containerRef, () => setIsOpen(false))

  const text = query.trim().toLowerCase()
  const matchingPages = text ? pages.filter((page) => page.label.toLowerCase().includes(text)) : []
  const matchingProducts = text
    ? products
        .filter((product) => product.name.toLowerCase().includes(text))
        .slice(0, MAX_PRODUCT_RESULTS)
    : []

  const hasResults = matchingPages.length > 0 || matchingProducts.length > 0
  const showDropdown = isOpen && text !== ''

  function finish() {
    setQuery('')
    setIsOpen(false)
  }

  function handlePageClick(page) {
    onNavigate(page.id)
    finish()
  }

  function handleProductClick(product) {
    onSelectProduct(product)
    finish()
  }

  // Pressing Enter picks the first result.
  function handleKeyDown(event) {
    if (event.key !== 'Enter') return
    if (matchingPages.length > 0) handlePageClick(matchingPages[0])
    else if (matchingProducts.length > 0) handleProductClick(matchingProducts[0])
  }

  const resultClasses =
    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-sage-light'

  return (
    <div ref={containerRef} className="relative w-full min-w-0 max-w-xs sm:max-w-sm">
      <Search
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        type="text"
        aria-label="Search pages and products"
        placeholder="Search pages & products..."
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-full border border-line bg-cream py-2 pl-10 pr-9 text-sm text-ink placeholder:text-muted focus:border-forest focus:outline-none"
      />

      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={finish}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-sage-light hover:text-forest"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}

      {showDropdown && (
        <div className="fixed left-4 right-4 top-[4.75rem] z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-white p-2 shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          {!hasResults && (
            <p className="px-3 py-4 text-center text-sm text-muted">
              No pages or products match "{query.trim()}".
            </p>
          )}

          {matchingPages.length > 0 && (
            <div>
              <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted">
                Pages
              </p>
              {matchingPages.map((page) => {
                const Icon = page.icon
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => handlePageClick(page)}
                    className={resultClasses}
                  >
                    <Icon size={16} aria-hidden="true" className="text-forest" />
                    {page.label}
                  </button>
                )
              })}
            </div>
          )}

          {matchingProducts.length > 0 && (
            <div>
              <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted">
                Products
              </p>
              {matchingProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleProductClick(product)}
                  className={resultClasses}
                >
                  <span aria-hidden="true">{getCategoryEmoji(product.category)}</span>
                  <span className="flex-1 truncate">{product.name}</span>
                  <span className="text-xs text-muted">{product.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default GlobalSearch