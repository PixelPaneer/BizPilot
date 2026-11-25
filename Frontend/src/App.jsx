import { lazy, Suspense, useEffect, useState } from 'react'
<<<<<<< origin/Frontend_v2
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useAuth, useInventory, useProfile } from './context/contextValues'
import ProtectedRoute from './context/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import HelpSupport from './components/settings/HelpSupport'
import SettingsPage from './components/settings/SettingsPage'
import Header from './components/Header'
import InventorySummary from './components/InventorySummary'
import LowStockAlertModal from './components/LowStockAlertModal'
import NotFoundPage from './components/NotFoundPage'
import PeriodSelect from './components/PeriodSelect'
import ProductInventory from './components/ProductInventory'
import UpdateStockPage from './components/stock/UpdateStockPage'
import Sidebar from './components/Sidebar'
import SignIn from './SignIn'
import ForgotPassword from './ForgotPassword'
import { translations } from './context/language'
import { fetchSettings, toLanguagePreferences } from './utils/settingsApi'
import { applyTheme } from './utils/theme'
import { pages } from './data/pages'
import { getGreeting, getStockStatus } from './utils/inventoryUtils'

const SalesInsightsPage = lazy(() => import('./components/sales/SalesInsightsPage'))
const LANGUAGE_PREFERENCES_KEY = 'bizpilot-language-preferences'

function getSavedLanguage() {
  try {
    const saved = JSON.parse(localStorage.getItem(LANGUAGE_PREFERENCES_KEY) || '{}')
    return translations[saved.language] ? saved.language : 'English'
  } catch (error) {
    console.error('Unable to read language preferences from local storage.', error)
    return 'English'
  }
}

=======
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
const SalesInsightsPage = lazy(() => import('./components/sales/SalesInsightsPage'))

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

>>>>>>> origin/frontend-insights-anwesha
function needsAttention(product) {
  const status = getStockStatus(product)
  return status === 'low-stock' || status === 'out-of-stock'
}

<<<<<<< origin/Frontend_v2
// The title and subtitle shown in the header (and above the page on small screens). The
// dashboard greets the owner by name; every other page uses its own name.
function getPageHeading(pageId, profile) {
  const page = pages.find((item) => item.id === pageId) ?? pages[0]
  if (page.id === 'dashboard') {
    const name = profile ? `, ${profile.firstName}` : ''
    return { title: `${getGreeting()}${name} 👋`, subtitle: page.subtitle }
=======
function buildSummaryAlert(products) {
  const items = products.filter(needsAttention)
  return items.length > 0 ? { kind: 'summary', items } : null
}

function getPageHeading(pageId) {
  const page = pages.find((item) => item.id === pageId) ?? pages[0]
  if (page.id === 'dashboard') {
    const firstName = currentUser.name.split(' ')[0]
    return { title: `${getGreeting()}, ${firstName} 👋`, subtitle: page.subtitle }
>>>>>>> origin/frontend-insights-anwesha
  }
  return { title: page.label, subtitle: page.subtitle }
}

<<<<<<< origin/Frontend_v2
function App() {
  const navigate = useNavigate()
  const { isAuthenticated, signOut } = useAuth()
  const { profile } = useProfile()
  const {
    products,
    isLoading,
    loadError,
    refreshProducts,
    stockAlert,
    addProduct,
    updateProduct,
    adjustStock,
    deleteProduct,
    openSummaryAlert,
    closeStockAlert,
  } = useInventory()
  const [period, setPeriod] = useState('month')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [requestedProductId, setRequestedProductId] = useState(null)
  const [language, setLanguage] = useState(getSavedLanguage)

  // After sign-in, the language and theme saved on the server replace the copy kept in this
  // browser (so they follow the owner to another device). If the request fails, the browser's
  // copy stays in use.
  useEffect(() => {
    if (!isAuthenticated) return undefined

    let cancelled = false
    fetchSettings()
      .then((settings) => {
        if (cancelled) return
        const preferences = toLanguagePreferences(settings)
        try {
          localStorage.setItem(LANGUAGE_PREFERENCES_KEY, JSON.stringify(preferences))
        } catch (error) {
          console.error('Unable to remember the language preferences.', error)
        }
        applyTheme(preferences.theme)
        if (translations[preferences.language]) setLanguage(preferences.language)
      })
      .catch((error) => console.error('Unable to load the saved preferences.', error))

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])
=======
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
>>>>>>> origin/frontend-insights-anwesha

  useEffect(() => {
    if (!isSidebarOpen) return
    const handler = (event) => {
<<<<<<< origin/Frontend_v2
      const target = event.target instanceof Element ? event.target : event.target?.parentElement
      if (target?.closest('.sidebar, #main-navigation, .burger')) return
      setIsSidebarOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => {
      document.removeEventListener('pointerdown', handler)
    }
  }, [isSidebarOpen])

  function handleNavigate(pageId) {
    navigate(`/${pageId}`)
=======
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
>>>>>>> origin/frontend-insights-anwesha
    setIsSidebarOpen(false)
  }

  function handleSelectProduct(product) {
    navigate('/inventory')
    setRequestedProductId(product.id)
  }

  function handleSignOut() {
<<<<<<< origin/Frontend_v2
    signOut()
    closeStockAlert()
=======
    setIsSignedIn(false)
    setStockAlert(null)
>>>>>>> origin/frontend-insights-anwesha
    setIsSidebarOpen(false)
    navigate('/signIn', { replace: true })
  }

<<<<<<< origin/Frontend_v2
  // Called after the sign-in (or sign-up) form has signed the owner in.
  function handleSignedIn() {
    openSummaryAlert()
    navigate('/dashboard', { replace: true })
  }

  // Every page has the same header, menu and low-stock pop-up. Only the heading differs.
  function renderChrome(heading, activePage) {
    const alertCount = products.filter(needsAttention).length

    return (
      <>
=======
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
>>>>>>> origin/frontend-insights-anwesha
        <Header
          products={products}
          heading={heading}
          alertCount={alertCount}
          isMenuOpen={isSidebarOpen}
          onMenuToggle={() => setIsSidebarOpen((open) => !open)}
          onNavigate={handleNavigate}
          onSelectProduct={handleSelectProduct}
<<<<<<< origin/Frontend_v2
          onOpenAlerts={openSummaryAlert}
          onSignOut={handleSignOut}
        />
        <Sidebar
          activePage={activePage}
=======
          onOpenAlerts={() => setStockAlert(buildSummaryAlert(products))}
          onSignOut={handleSignOut}
        />
        <Sidebar
          activePage={pageId}
>>>>>>> origin/frontend-insights-anwesha
          onNavigate={handleNavigate}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
<<<<<<< origin/Frontend_v2
      </>
    )
  }

  function renderAlertModal() {
    if (!stockAlert) return null

    return (
      <LowStockAlertModal
        alert={stockAlert}
        onClose={closeStockAlert}
        onViewInventory={() => {
          closeStockAlert()
          handleNavigate('inventory')
        }}
      />
    )
  }

  // The header only has room for the heading on wide screens; below that it appears here.
  // `action` (the dashboard's period selector) sits on the same row, at the right.
  function renderSmallScreenHeading(heading, spacing = '', action = null) {
    return (
      <div className={`${spacing} flex items-start justify-between gap-4 xl:hidden`}>
        <div className="min-w-0">
          <h1 className="page-heading-title">{heading.title}</h1>
          <p className="page-heading-subtitle">{heading.subtitle}</p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    )
  }

  // Help and Settings draw their own (translated) title inside the page, so the extra small-screen
  // heading is only added for pages that have none (the dashboard).
  function renderDashboardPage(
    pageId,
    content,
    { showSmallScreenHeading = false, headingAction = null } = {},
  ) {
    const heading = getPageHeading(pageId, profile)

    return (
      <div className="app">
        {renderChrome(heading, pageId)}
        <div className="main">
          <main className="content">
            {showSmallScreenHeading && renderSmallScreenHeading(heading, 'mb-5', headingAction)}
            {content}
          </main>
        </div>
        {renderAlertModal()}
      </div>
    )
  }

  function renderInventoryPage() {
    const heading = getPageHeading('inventory', profile)

    return (
      <div className="min-h-screen bg-cream">
        {renderChrome(heading, 'inventory')}
        <main className="px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {renderSmallScreenHeading(heading)}
            <InventorySummary products={products} />
            <ProductInventory
              products={products}
              isLoading={isLoading}
              loadError={loadError}
              requestedProductId={requestedProductId}
              onRequestHandled={() => setRequestedProductId(null)}
              onAddProduct={addProduct}
              onUpdateProduct={updateProduct}
              onAdjustStock={adjustStock}
              onDeleteProduct={deleteProduct}
            />
          </div>
        </main>
        {renderAlertModal()}
      </div>
    )
  }

  function renderUpdateStockPage() {
    const heading = {
      title: 'Update Stock',
      subtitle: 'Record sales and purchases to keep your stock accurate.',
    }

    return (
      <div className="min-h-screen bg-cream">
        {renderChrome(heading, 'inventory')}
        <main className="px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl space-y-6">
            {renderSmallScreenHeading(heading)}
            <UpdateStockPage
              products={products}
              isLoading={isLoading}
              loadError={loadError}
              onRefresh={refreshProducts}
              onNavigate={handleNavigate}
            />
          </div>
        </main>
        {renderAlertModal()}
=======
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
>>>>>>> origin/frontend-insights-anwesha
      </div>
    )
  }

  function renderSalesPage() {
<<<<<<< origin/Frontend_v2
    const heading = getPageHeading('analytics', profile)

    return (
      <div className="min-h-screen bg-cream">
        {renderChrome(heading, 'analytics')}
=======
    const heading = getPageHeading('analytics')
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
          activePage="analytics"
          onNavigate={handleNavigate}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
>>>>>>> origin/frontend-insights-anwesha
        <main className="px-4 py-6 sm:px-6">
          <Suspense
            fallback={
              <div
                className="mx-auto max-w-[1400px] py-12 text-center text-sm text-muted"
                role="status"
              >
                Loading sales insights...
              </div>
            }
          >
            <SalesInsightsPage />
          </Suspense>
        </main>
<<<<<<< origin/Frontend_v2
        {renderAlertModal()}
=======
        {stockAlert && (
          <LowStockAlertModal
            alert={stockAlert}
            onClose={() => setStockAlert(null)}
            onViewInventory={() => setStockAlert(null)}
          />
        )}
>>>>>>> origin/frontend-insights-anwesha
      </div>
    )
  }

<<<<<<< origin/Frontend_v2
  const protectedPage = (element) => <ProtectedRoute>{element}</ProtectedRoute>

  return (
    <Routes>
      <Route path="/signIn" element={<SignIn onSignedIn={handleSignedIn} />} />
      <Route path="/forgotPassword" element={<ForgotPassword />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={protectedPage(renderDashboardPage('dashboard', <Dashboard period={period} onPeriodChange={setPeriod} />, {
        showSmallScreenHeading: true,
        headingAction: <PeriodSelect value={period} onChange={setPeriod} />,
      }))} />
      <Route path="/inventory" element={protectedPage(renderInventoryPage())} />
      <Route path="/inventory/update-stock" element={protectedPage(renderUpdateStockPage())} />
      <Route path="/analytics" element={protectedPage(renderSalesPage())} />
      <Route
        path="/help"
        element={protectedPage(renderDashboardPage(
          'help',
          <HelpSupport language={language} />,
=======
  const signedIn = (element) => (isSignedIn ? element : <Navigate to="/signIn" replace />)

  return (
    <Routes>
      <Route path="/signIn" element={<SignIn onSignIn={handleSignIn} />} />
      <Route path="/" element={signedIn(renderDashboardPage(<Dashboard period={period} />))} />
      <Route path="/inventory" element={signedIn(renderInventoryPage())} />
      <Route path="/analytics" element={signedIn(renderSalesPage())} />
      <Route
        path="/help"
        element={signedIn(renderDashboardPage(
          <PlaceholderPage title="Help & Support" text="Find answers and get in touch with support." />,
>>>>>>> origin/frontend-insights-anwesha
        ))}
      />
      <Route
        path="/settings"
<<<<<<< origin/Frontend_v2
        element={protectedPage(renderDashboardPage(
          'settings',
          <SettingsPage
            language={language}
            onLanguageChange={setLanguage}
            t={translations[language] ?? translations.English}
          />,
        ))}
      />
      <Route
        path="*"
        element={isAuthenticated ? <NotFoundPage /> : <Navigate to="/signIn" replace />}
      />
=======
        element={signedIn(renderDashboardPage(
          <PlaceholderPage title="Settings" text="Configure your BizPilot account and preferences." />,
        ))}
      />
      <Route path="*" element={<Navigate to={isSignedIn ? '/' : '/signIn'} replace />} />
>>>>>>> origin/frontend-insights-anwesha
    </Routes>
  )
}

export default App
