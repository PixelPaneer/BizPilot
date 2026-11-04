import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import InventoryTabs from './InventoryTabs'
import InventoryToolbar from './InventoryToolbar'
import ProductTable from './ProductTable'
import Pagination from './Pagination'
import ProductFormModal from './ProductFormModal'
import ProductActionsModal from './ProductActionsModal'
import StockAdjustmentModal from './StockAdjustmentModal'
import DeleteConfirmationModal from './DeleteConfirmationModal'
import ExportMenu from './ExportMenu'
import { filterProducts, getStockCounts, getCategoryOptions } from '../utils/inventoryUtils'
import { useLockBodyScroll } from '../utils/useLockBodyScroll'

const PAGE_SIZE = 10

const tabLabels = {
  all: 'All Products',
  'in-stock': 'In Stock',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
}

function ProductInventory({
  products,
  requestedProductId,
  onRequestHandled,
  onAddProduct,
  onUpdateProduct,
  onAdjustStock,
  onDeleteProduct,
}) {
  const [activeTab, setActiveTab] = useState('all')
  const [category, setCategory] = useState('all')
  const [sortOrder, setSortOrder] = useState('none')
  // This table's own search text (separate from the top search bar).
  const [searchQuery, setSearchQuery] = useState('')

  // modal: 'none' | 'add' | 'actions' | 'edit' | 'adjust' | 'delete'
  const [modal, setModal] = useState('none')
  const [selectedProductId, setSelectedProductId] = useState(null)

  // Remembers the page number AND which filters it was chosen under.
  const [pageState, setPageState] = useState({ key: '', page: 1 })

  // The page behind a pop-up should not scroll.
  useLockBodyScroll(modal !== 'none')

  // When a product is picked in the top search bar, open its pop-up.
  useEffect(() => {
    if (!requestedProductId) return
    setSelectedProductId(requestedProductId)
    setModal('actions')
    if (onRequestHandled) onRequestHandled()
  }, [requestedProductId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedProduct = products.find((product) => product.id === selectedProductId)

  const counts = getStockCounts(products)

  // Built-in categories + any custom ones your products use.
  const categoryOptions = getCategoryOptions(products)
  // If the chosen filter category no longer exists, fall back to "all".
  const activeCategory =
    category === 'all' || categoryOptions.includes(category) ? category : 'all'

  // ALL products that match the tab, search and filters. Export uses this list.
  const visibleProducts = filterProducts(products, {
    tab: activeTab,
    searchQuery,
    category: activeCategory,
    sortOrder,
  })

  // --- Pagination ---
  const filterKey = [activeTab, activeCategory, sortOrder, searchQuery].join('|')
  const requestedPage = pageState.key === filterKey ? pageState.page : 1
  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const pageProducts = visibleProducts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const emptyMessage =
    products.length === 0
      ? 'Your inventory is empty. Click "Add Product" to add your first product.'
      : 'No products match your current tab, search or filters.'

  function handlePageChange(page) {
    setPageState({ key: filterKey, page })
  }

  function closeModal() {
    setModal('none')
    setSelectedProductId(null)
  }

  function handleSelectProduct(product) {
    setSelectedProductId(product.id)
    setModal('actions')
  }

  function handleResetFilters() {
    setCategory('all')
    setSortOrder('none')
  }

  function handleSaveNew(productData) {
    onAddProduct(productData)
    closeModal()
  }

  function handleSaveEdit(productData) {
    onUpdateProduct(selectedProductId, productData)
    closeModal()
  }

  function handleConfirmAdjust(adjustment) {
    onAdjustStock(selectedProductId, adjustment)
    closeModal()
  }

  function handleConfirmDelete() {
    onDeleteProduct(selectedProductId)
    closeModal()
  }

  return (
    <section
      aria-label="Product inventory"
      className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6"
    >
      {/* Heading + buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-ink">Product Inventory</h2>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <ExportMenu
            products={visibleProducts}
            tabLabel={tabLabels[activeTab]}
            filters={{ searchQuery, category: activeCategory, sortOrder }}
          />
          <button
            type="button"
            onClick={() => setModal('add')}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-deep sm:flex-none"
          >
            <Plus size={16} aria-hidden="true" />
            Add Product
          </button>
        </div>
      </div>

      {/* Tabs + search/filter */}
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <InventoryTabs activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />
        <InventoryToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categories={categoryOptions}
          category={activeCategory}
          onCategoryChange={setCategory}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          onResetFilters={handleResetFilters}
        />
      </div>

      {/* Table */}
      <div className="mt-4">
        {pageProducts.length > 0 && (
          <p className="mb-2 text-xs text-muted sm:hidden">Swipe sideways to see all columns →</p>
        )}

        <ProductTable
          products={pageProducts}
          emptyMessage={emptyMessage}
          onSelectProduct={handleSelectProduct}
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={visibleProducts.length}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Pop-ups: only one is shown at a time */}
      {modal === 'add' && (
        <ProductFormModal
          categories={categoryOptions}
          onSave={handleSaveNew}
          onClose={closeModal}
        />
      )}

      {modal === 'actions' && selectedProduct && (
        <ProductActionsModal
          product={selectedProduct}
          onAdjustStock={() => setModal('adjust')}
          onEdit={() => setModal('edit')}
          onDelete={() => setModal('delete')}
          onClose={closeModal}
        />
      )}

      {modal === 'edit' && selectedProduct && (
        <ProductFormModal
          product={selectedProduct}
          categories={categoryOptions}
          onSave={handleSaveEdit}
          onClose={closeModal}
        />
      )}

      {modal === 'adjust' && selectedProduct && (
        <StockAdjustmentModal
          product={selectedProduct}
          onConfirm={handleConfirmAdjust}
          onClose={closeModal}
        />
      )}

      {modal === 'delete' && selectedProduct && (
        <DeleteConfirmationModal
          product={selectedProduct}
          onConfirm={handleConfirmDelete}
          onCancel={closeModal}
        />
      )}
    </section>
  )
}

export default ProductInventory