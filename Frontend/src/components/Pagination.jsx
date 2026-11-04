import { ArrowLeft, ArrowRight } from 'lucide-react'

// Builds a list like [1, '...', 4, 5, 6, '...', 12]
function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = [1]
  if (currentPage > 3) pages.push('...')

  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)
  for (let page = start; page <= end; page += 1) pages.push(page)

  if (currentPage < totalPages - 2) pages.push('...')
  pages.push(totalPages)

  return pages
}

const arrowButtonClasses =
  'flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-sage-light disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'

function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }) {
  if (totalPages <= 1) return null

  const firstItem = (currentPage - 1) * pageSize + 1
  const lastItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-col items-center gap-3 border-t border-line pt-4 sm:flex-row sm:justify-between"
    >
      <p className="text-sm text-muted">
        Showing {firstItem}–{lastItem} of {totalItems} products
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={arrowButtonClasses}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
          <span className="sr-only sm:hidden">Previous page</span>
        </button>

        {/* Page numbers: tablets and bigger */}
        <div className="hidden items-center gap-1 sm:flex">
          {getPageNumbers(currentPage, totalPages).map((page, index) =>
            page === '...' ? (
              <span key={`dots-${index}`} className="px-2 text-sm text-muted" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
                className={`h-9 min-w-9 rounded-lg px-2 text-sm font-medium transition-colors ${
                  page === currentPage
                    ? 'bg-forest text-white'
                    : 'text-ink hover:bg-sage-light'
                }`}
              >
                {page}
              </button>
            ),
          )}
        </div>

        {/* Short text instead of numbers: phones */}
        <span className="px-3 text-sm text-ink sm:hidden">
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={arrowButtonClasses}
        >
          <span className="hidden sm:inline">Next</span>
          <span className="sr-only sm:hidden">Next page</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}

export default Pagination