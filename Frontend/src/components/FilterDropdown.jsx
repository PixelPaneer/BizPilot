import { useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useClickOutside } from '../utils/useClickOutside'

const selectClasses =
  'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none'

function FilterDropdown({
  categories,
  category,
  onCategoryChange,
  sortOrder,
  onSortChange,
  onReset,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef(null)
  const hasActiveFilters = category !== 'all' || sortOrder !== 'none'

  useClickOutside(panelRef, () => setIsOpen(false))

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label="Open filters"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-cream text-forest transition-colors hover:bg-sage-light"
      >
        <SlidersHorizontal size={18} aria-hidden="true" />
        {hasActiveFilters && (
          <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-gold" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-line bg-white p-4 shadow-lg">
          <label htmlFor="filter-category" className="text-sm font-medium text-ink">
            Category
          </label>
          <select
            id="filter-category"
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
            className={selectClasses}
          >
            <option value="all">All Categories</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <label htmlFor="filter-sort" className="mt-4 block text-sm font-medium text-ink">
            Sort by price
          </label>
          <select
            id="filter-sort"
            value={sortOrder}
            onChange={(event) => onSortChange(event.target.value)}
            className={selectClasses}
          >
            <option value="none">Default order</option>
            <option value="low-high">Price: Low to High</option>
            <option value="high-low">Price: High to Low</option>
          </select>

          <button
            type="button"
            onClick={onReset}
            disabled={!hasActiveFilters}
            className="mt-4 w-full rounded-full border border-line py-2 text-sm font-medium text-forest transition-colors hover:bg-sage-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  )
}

export default FilterDropdown