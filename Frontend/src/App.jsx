import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import DashboardHeader from './components/DashboardHeader'
import DashboardSidebar from './components/DashboardSidebar'
import Header from './components/Header'
import InventorySummary from './components/InventorySummary'
import LowStockAlertModal from './components/LowStockAlertModal'
import PlaceholderPage from './components/PlaceholderPage'
import ProductInventory from './components/ProductInventory'
import Sidebar from './components/Sidebar'
import SignIn from './SignIn'
import { currentUser } from './data/user'
import { pages } from './data/pages'
import { initialProducts } from './data/products'
import { getStockStatus, getGreeting } from './utils/inventoryUtils'

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

function loadSignedIn() {
  try {
    return localStorage.getItem(SIGN_IN_KEY) !== 'false'
  } catch {
    return true
  }
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function needsAttention(product) {
  const status = getStockStatus(product)
  return status === 'low-stock' || status === 'out-of-stock'
}

function buildSummaryAlert(products) {
  const items = products.filter(needsAttention)
  return items.length > 0 ? { kind: 'summary', items } : null
}

function getPageHeading(pageId) {
  const page = pages.find((item) => item.id === pageId) ?? pages[0]
  if (page.id === 'dashboard') {
    const firstName = currentUser.name.split(' ')[0]
    return { title: `${getGreeting()}, ${firstName} 👋`, subtitle: page.subtitle }
  }
  return { title: page.label, subtitle: page.subtitle }
}

function getPageId(pathname) {
  if (pathname === '/') return 'dashboard'
  return pathname.slice(1)
}

function App() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [products, setProducts] = useState(loadProducts)
  const [isSignedIn, setIsSignedIn] = useState(loadSignedIn)
  const [period, setPeriod] = useState('month')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [requestedProductId, setRequestedProductId] = useState(null)
  const [stockAlert, setStockAlert] = useState(() =>
    loadSignedIn() ? buildSummaryAlert(products) : null,
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
  }, [products])

  useEffect(() => {
    localStorage.setItem(SIGN_IN_KEY, String(isSignedIn))
  }, [isSignedIn])

  useEffect(() => {
    if (!isSidebarOpen) return
    const handler = (event) => {
      if (event.target.closest('.sidebar, .burger')) return
      setIsSidebarOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [isSidebarOpen])

  function alertIfWorse(before, after) {
    if (!needsAttention(after)) return
    if (before && getStockStatus(before) === getStockStatus(after)) return
    setStockAlert({ kind: 'change', items: [after] })
  }

  function handleAddProduct(productData) {
    const product = { id: createId(), ...productData }
    setProducts((current) => [product, ...current])
    alertIfWorse(null, product)
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

  function handleNavigate(pageId) {
    navigate(pageId === 'dashboard' ? '/' : `/${pageId}`)
    setIsSidebarOpen(false)
  }

  function handleSelectProduct(product) {
    navigate('/inventory')
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
    setStockAlert(buildSummaryAlert(products))
    navigate('/inventory', { replace: true })
  }

  function renderDashboardPage(content) {
    return (
      <div className={`app ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <DashboardSidebar open={isSidebarOpen} onNavigate={() => setIsSidebarOpen(false)} />
        <div className="main">
          <DashboardHeader
            onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
            sidebarOpen={isSidebarOpen}
            period={period}
            onPeriodChange={setPeriod}
            onSignOut={handleSignOut}
          />
          <main className="content">{content}</main>
        </div>
      </div>
    )
  }

  function renderInventoryPage() {
    const pageId = getPageId(pathname)
    const heading = getPageHeading(pageId)
    const alertCount = products.filter(needsAttention).length

    return (
      <div className="min-h-screen bg-cream">
        <Header
          products={products}
          heading={heading}
          alertCount={alertCount}
          isMenuOpen={isSidebarOpen}
          onMenuToggle={() => setIsSidebarOpen((open) => !open)}
          onNavigate={handleNavigate}
          onSelectProduct={handleSelectProduct}
          onOpenAlerts={() => setStockAlert(buildSummaryAlert(products))}
          onSignOut={handleSignOut}
        />
        <Sidebar
          activePage={pageId}
          onNavigate={handleNavigate}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="xl:hidden">
              <h1 className="text-2xl font-bold text-ink">{heading.title}</h1>
              <p className="mt-1 text-sm text-muted">{heading.subtitle}</p>
            </div>
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
          </div>
        </main>
        {stockAlert && (
          <LowStockAlertModal
            alert={stockAlert}
            onClose={() => setStockAlert(null)}
            onViewInventory={() => setStockAlert(null)}
          />
        )}
      </div>
    )
  }

  const signedIn = (element) => (isSignedIn ? element : <Navigate to="/signIn" replace />)

  return (
    <Routes>
      <Route path="/signIn" element={<SignIn onSignIn={handleSignIn} />} />
      <Route path="/" element={signedIn(renderDashboardPage(<Dashboard period={period} />))} />
      <Route path="/inventory" element={signedIn(renderInventoryPage())} />
      <Route
        path="/analytics"
        element={signedIn(renderDashboardPage(
          <PlaceholderPage title="Business Analytics" text="Detailed sales and business insights will appear here." />,
        ))}
      />
      <Route
        path="/help"
        element={signedIn(renderDashboardPage(
          <PlaceholderPage title="Help & Support" text="Find answers and get in touch with support." />,
        ))}
      />
      <Route
        path="/settings"
        element={signedIn(renderDashboardPage(
          <PlaceholderPage title="Settings" text="Configure your BizPilot account and preferences." />,
        ))}
      />
      <Route path="*" element={<Navigate to={isSignedIn ? '/' : '/signIn'} replace />} />
    </Routes>
  )
}

export default App
