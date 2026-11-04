import { Search } from 'lucide-react'
import FilterDropdown from './FilterDropdown'

function InventoryToolbar({
  searchQuery,
  onSearchChange,
  categories,
  category,
  onCategoryChange,
  sortOrder,
  onSortChange,
  onResetFilters,
}) {
  return (
    <div className="flex w-full items-center gap-2 lg:w-auto">
      <div className="relative flex-1 lg:w-72">
        <Search
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          aria-label="Search products in inventory"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-full border border-line bg-cream py-2 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-forest focus:outline-none"
        />
      </div>

      <FilterDropdown
        categories={categories}
        category={category}
        onCategoryChange={onCategoryChange}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
        onReset={onResetFilters}
      />
    </div>
  )
}

export default InventoryToolbar