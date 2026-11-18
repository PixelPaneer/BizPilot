import { useCallback, useRef, useState } from 'react'
import { useClickOutside } from '../../utils/useClickOutside'

const MAX_RESULTS = 8

const inputClasses =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-forest focus:outline-none'

// A search box that lists matching products. Products already used on other lines of the
// entry are left out so the same product cannot be added twice.
function ProductPicker({ id, label, products, selectedId, excludeIds = [], onSelect, hasError }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const close = useCallback(() => setIsOpen(false), [])
  useClickOutside(containerRef, close)

  const selected = products.find((product) => product.id === selectedId)
  const text = query.trim().toLowerCase()
  const matches = products
    .filter(
      (product) =>
        !excludeIds.includes(product.id) &&
        (text === '' || product.name.toLowerCase().includes(text)),
    )
    .slice(0, MAX_RESULTS)

  function choose(product) {
    onSelect(product.id)
    setQuery('')
    setIsOpen(false)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && isOpen) {
      event.preventDefault()
      if (matches.length > 0) choose(matches[0])
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={`${id}-list`}
        aria-invalid={hasError}
        autoComplete="off"
        placeholder="Search product..."
        value={isOpen ? query : (selected?.name ?? '')}
        onFocus={() => {
          setQuery('')
          setIsOpen(true)
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        onKeyDown={handleKeyDown}
        className={`${inputClasses} ${hasError ? 'border-danger-text' : 'border-line'}`}
      />

      {isOpen && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-lg"
        >
          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">No matching product.</li>
          )}
          {matches.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                role="option"
                aria-selected={product.id === selectedId}
                onClick={() => choose(product)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-ink hover:bg-sage-light"
              >
                <span className="truncate font-medium">{product.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {product.quantity} {product.unit}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ProductPicker
