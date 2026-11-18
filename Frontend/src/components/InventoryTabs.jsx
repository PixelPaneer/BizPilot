function InventoryTabs({ activeTab, onTabChange, counts }) {
  const tabs = [
    { id: 'all', label: 'All Products', count: counts.total },
    { id: 'in-stock', label: 'In Stock', count: counts.inStock },
    { id: 'low-stock', label: 'Low Stock', count: counts.lowStock },
    { id: 'out-of-stock', label: 'Out of Stock', count: counts.outOfStock },
  ]

  return (
    <div role="tablist" aria-label="Stock status" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-forest text-white'
                : 'text-muted hover:bg-sage-light hover:text-forest'
            }`}
          >
            {tab.label}
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                isActive ? 'bg-white/20 text-white' : 'bg-sage-light text-forest'
              }`}
            >
              {tab.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default InventoryTabs