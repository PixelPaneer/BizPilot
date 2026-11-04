import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import InventorySummary from './components/InventorySummary'
import ProductInventory from './components/ProductInventory'
import PlaceholderPage from './components/PlaceholderPage'
import SignIn from './SignIn'
import LowStockAlertModal from './components/LowStockAlertModal'
import { initialProducts } from './data/products'
import { pages } from './data/pages'
import { currentUser } from './data/user'
import { getStockStatus } from './utils/inventoryUtils'

const STORAGE_KEY = 'bizpilot-products'
const SIGN_IN_KEY = 'bizpilot-signed-in'

function loadProducts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : initialProducts
  } catch {
    return initialProducts
  }
}

// You are signed in unless you previously signed out.
function loadSignedIn() {
  try {
    return localStorage.getItem(SIGN_IN_KEY) !== 'false'
  } catch {
    return true
  }
}

// crypto.randomUUID only works on https or localhost. This fallback keeps
// "Add Product" working when you open the app on your phone over Wi-Fi.
function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// A product "needs attention" when it is low on stock or out of stock.
function needsAttention(product) {
  const status = getStockStatus(product)
  return status === 'low-stock' || status === 'out-of-stock'
}

// Builds the pop-up listing every product that needs restocking (or null if none).
function buildSummaryAlert(products) {
  const items = products.filter(needsAttention)
  return items.length > 0 ? { kind: 'summary', items } : null
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// The title and subtitle shown at the top of each page.
function getPageHeading(pageId) {
  const page = pages.find((item) => item.id === pageId) ?? pages[0]

  if (page.id === 'dashboard') {
    const firstName = currentUser.name.split(' ')[0]
    return { title: `${getGreeting()}, ${firstName} 👋`, subtitle: page.subtitle }
  }
  return { title: page.label, subtitle: page.subtitle }
}

function App() {
  const navigate = useNavigate()
  const [products, setProducts] = useState(loadProducts)
  const [isSignedIn, setIsSignedIn] = useState(loadSignedIn)
  const [activePage, setActivePage] = useState('inventory')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  // Set when you click a product in the top search bar.
  const [requestedProductId, setRequestedProductId] = useState(null)
  // The low-stock pop-up. On first load, show a summary if anything needs restocking.
  const [stockAlert, setStockAlert] = useState(() =>
    loadSignedIn() ? buildSummaryAlert(products) : null,
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
  }, [products])

  useEffect(() => {
    localStorage.setItem(SIGN_IN_KEY, String(isSignedIn))
  }, [isSignedIn])

  // Raises a pop-up only if the product's status just got worse.
  function alertIfWorse(before, after) {
    if (!needsAttention(after)) return
    if (before && getStockStatus(before) === getStockStatus(after)) return
    setStockAlert({ kind: 'change', items: [after] })
  }

  function handleAddProduct(productData) {
    const newProduct = { id: createId(), ...productData }
    setProducts((current) => [newProduct, ...current])
    alertIfWorse(null, newProduct)
  }

  function handleUpdateProduct(id, productData) {
    const before = products.find((product) => product.id === id)
    if (!before) return
    const after = { ...before, ...productData }
    setProducts((current) => current.map((product) => (product.id === id ? after : product)))
    alertIfWorse(before, after)
  }

  function handleAdjustStock(id, { newQuantity, type, amount }) {
    const before = products.find((product) => product.id === id)
    if (!before) return
    const after = {
      ...before,
      quantity: newQuantity,
      lastAdjustment: { type, amount, date: new Date().toISOString() },
    }
    setProducts((current) => current.map((product) => (product.id === id ? after : product)))
    alertIfWorse(before, after)
  }

  function handleDeleteProduct(id) {
    setProducts((current) => current.filter((product) => product.id !== id))
  }

  function handleNavigate(page) {
    setActivePage(page)
    setIsSidebarOpen(false)
  }

  // From the top search: go to Inventory and open that product's pop-up.
  function handleSelectProductFromSearch(product) {
    setActivePage('inventory')
    setRequestedProductId(product.id)
  }

  function handleSignOut() {
    setIsSignedIn(false)
    setStockAlert(null)
    setIsSidebarOpen(false)
    navigate('/signIn', { replace: true })
  }

  function handleSignIn() {
    setIsSignedIn(true)
    setActivePage('inventory')
    setStockAlert(buildSummaryAlert(products))
    navigate('/inventory', { replace: true })
  }

  function handleViewInventory() {
    setStockAlert(null)
    handleNavigate('inventory')
  }

  const heading = getPageHeading(activePage)
  const currentPage = pages.find((page) => page.id === activePage) ?? pages[0]
  const alertCount = products.filter(needsAttention).length

  return (
    <Routes>
      <Route path="/signIn" element={<SignIn onSignIn={handleSignIn} />} />
      <Route
        path="/inventory"
        element={
          isSignedIn ? (
            <div className="min-h-screen bg-cream">
              <Header
                products={products}
                heading={heading}
                alertCount={alertCount}
                isMenuOpen={isSidebarOpen}
                onMenuToggle={() => setIsSidebarOpen((open) => !open)}
                onNavigate={handleNavigate}
                onSelectProduct={handleSelectProductFromSearch}
                onOpenAlerts={() => setStockAlert(buildSummaryAlert(products))}
                onSignOut={handleSignOut}
              />

              <Sidebar
                activePage={activePage}
                onNavigate={handleNavigate}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
              />

              <main className="px-4 py-6 sm:px-6">
                <div className="mx-auto max-w-7xl space-y-6">
                  {/* On screens narrower than 1280px the title lives here instead of the header */}
                  <div className="xl:hidden">
                    <h1 className="text-2xl font-bold text-ink">{heading.title}</h1>
                    <p className="mt-1 text-sm text-muted">{heading.subtitle}</p>
                  </div>

                  {activePage === 'inventory' ? (
                    <>
                      <InventorySummary products={products} />
                      <ProductInventory
                        products={products}
                        requestedProductId={requestedProductId}
                        onRequestHandled={() => setRequestedProductId(null)}
                        onAddProduct={handleAddProduct}
                        onUpdateProduct={handleUpdateProduct}
                        onAdjustStock={handleAdjustStock}
                        onDeleteProduct={handleDeleteProduct}
                      />
                    </>
                  ) : (
                    <PlaceholderPage title={currentPage.label} />
                  )}
                </div>
              </main>

              {stockAlert && (
                <LowStockAlertModal
                  alert={stockAlert}
                  onClose={() => setStockAlert(null)}
                  onViewInventory={handleViewInventory}
                />
              )}
            </div>
          ) : (
            <Navigate to="/signIn" replace />
          )
        }
      />
      <Route
        path="*"
        element={<Navigate to={isSignedIn ? '/inventory' : '/signIn'} replace />}
      />
    </Routes>
  )
}

export default App