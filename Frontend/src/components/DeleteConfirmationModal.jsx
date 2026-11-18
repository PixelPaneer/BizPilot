import { useEffect } from 'react'
import { TriangleAlert } from 'lucide-react'

function DeleteConfirmationModal({ product, onConfirm, onCancel }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger-text">
          <TriangleAlert size={22} aria-hidden="true" />
        </div>

        <h2 id="delete-title" className="mt-4 text-xl font-semibold text-ink">
          Delete product?
        </h2>
        <p id="delete-description" className="mt-2 text-sm text-muted">
          You are about to delete <span className="font-semibold text-ink">{product.name}</span>.
          This cannot be undone.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-line px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-danger-text px-5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmationModal