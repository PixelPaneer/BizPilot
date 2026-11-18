import { useRef, useState } from 'react'
import { Download, ChevronDown, FileText, FileSpreadsheet } from 'lucide-react'
import { exportToPdf, exportToExcel } from '../utils/exportUtils'
import { useClickOutside } from '../utils/useClickOutside'

function ExportMenu({ products, tabLabel, filters }) {
  const [isOpen, setIsOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const menuRef = useRef(null)

  function closeMenu() {
    setIsOpen(false)
    setNotice('')
  }

  useClickOutside(menuRef, closeMenu)

  function toggleMenu() {
    setIsOpen(!isOpen)
    setNotice('')
  }

  function handleExport(kind) {
    // Rule: never create an empty report.
    if (products.length === 0) {
      setNotice(
        `There are no products to export in "${tabLabel}" with the current search and filters.`,
      )
      return
    }

    try {
      if (kind === 'pdf') exportToPdf(products, tabLabel, filters)
      if (kind === 'excel') exportToExcel(products, tabLabel)
      closeMenu()
    } catch (error) {
      console.error(error)
      setNotice('Something went wrong while creating the file. Please try again.')
    }
  }

  const optionClasses =
    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-sage-light'

  return (
    <div className="relative flex-1 sm:flex-none" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggleMenu}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-forest px-4 py-2 text-sm font-medium text-forest transition-colors hover:bg-sage-light sm:w-auto"
      >
        <Download size={16} aria-hidden="true" />
        Export
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 z-20 mt-2 w-60 rounded-xl border border-line bg-white p-2 shadow-lg sm:left-auto sm:right-0"
        >
          <p className="px-3 pb-2 pt-1 text-xs text-muted">
            Export {products.length} {products.length === 1 ? 'product' : 'products'} from{' '}
            <span className="font-medium text-ink">{tabLabel}</span>
          </p>

          <button type="button" role="menuitem" onClick={() => handleExport('pdf')} className={optionClasses}>
            <FileText size={16} aria-hidden="true" className="text-forest" />
            Download PDF
          </button>
          <button type="button" role="menuitem" onClick={() => handleExport('excel')} className={optionClasses}>
            <FileSpreadsheet size={16} aria-hidden="true" className="text-forest" />
            Download Excel (.xlsx)
          </button>

          {notice && (
            <p role="alert" className="mt-2 rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn-text">
              {notice}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default ExportMenu