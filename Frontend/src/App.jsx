import { lazy, Suspense, useEffect, useState } from 'react'
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
import ProductInventory from './components/ProductInventory'
import UpdateStockPage from './components/stock/UpdateStockPage'
import Sidebar from './components/Sidebar'
import SignIn from './SignIn'
import { translations } from './context/language'
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

function needsAttention(product) {
  const status = getStockStatus(product)
  return status === 'low-stock' || status === 'out-of-stock'
}

// The title and subtitle shown in the header (and above the page on small screens). The
// dashboard greets the owner by name; every other page uses its own name.
function getPageHeading(pageId, profile) {
  const page = pages.find((item) => item.id === pageId) ?? pages[0]
  if (page.id === 'dashboard') {
    const name = profile ? `, ${profile.firstName}` : ''
    return { title: `${getGreeting()}${name} 👋`, subtitle: page.subtitle }
  }
  return { title: page.label, subtitle: page.subtitle }
}

function App() {
  const navigate = useNavigate()
  const { isAuthenticated, signIn, signOut } = useAuth()
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

  useEffect(() => {
    if (!isSidebarOpen) return
    const handler = (event) => {
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
    setIsSidebarOpen(false)
  }

  function handleSelectProduct(product) {
    navigate('/inventory')
    setRequestedProductId(product.id)
  }

  function handleSignOut() {
    signOut()
    closeStockAlert()
    setIsSidebarOpen(false)
    navigate('/signIn', { replace: true })
  }

  function handleSignIn() {
    signIn()
    openSummaryAlert()
    navigate('/dashboard', { replace: true })
  }

  // Every page has the same header, menu and low-stock pop-up. Only the heading differs.
  function renderChrome(heading, activePage) {
    const alertCount = products.filter(needsAttention).length

    return (
      <>
        <Header
          products={products}
          heading={heading}
          alertCount={alertCount}
          isMenuOpen={isSidebarOpen}
          onMenuToggle={() => setIsSidebarOpen((open) => !open)}
          onNavigate={handleNavigate}
          onSelectProduct={handleSelectProduct}
          onOpenAlerts={openSummaryAlert}
          onSignOut={handleSignOut}
        />
        <Sidebar
          activePage={activePage}
          onNavigate={handleNavigate}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
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
  function renderSmallScreenHeading(heading, spacing = '') {
    return (
      <div className={`${spacing} xl:hidden`}>
        <h1 className="page-heading-title">{heading.title}</h1>
        <p className="page-heading-subtitle">{heading.subtitle}</p>
      </div>
    )
  }

  // Help and Settings draw their own (translated) title inside the page, so the extra small-screen
  // heading is only added for pages that have none (the dashboard).
  function renderDashboardPage(pageId, content, showSmallScreenHeading = false) {
    const heading = getPageHeading(pageId, profile)

    return (
      <div className="app">
        {renderChrome(heading, pageId)}
        <div className="main">
          <main className="content">
            {showSmallScreenHeading && renderSmallScreenHeading(heading, 'mb-5')}
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
      </div>
    )
  }

  function renderSalesPage() {
    const heading = getPageHeading('analytics', profile)

    return (
      <div className="min-h-screen bg-cream">
        {renderChrome(heading, 'analytics')}
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
        {renderAlertModal()}
      </div>
    )
  }

  const protectedPage = (element) => <ProtectedRoute>{element}</ProtectedRoute>

  return (
    <Routes>
      <Route path="/signIn" element={<SignIn onSignIn={handleSignIn} />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={protectedPage(renderDashboardPage('dashboard', <Dashboard period={period} onPeriodChange={setPeriod} />, true))} />
      <Route path="/inventory" element={protectedPage(renderInventoryPage())} />
      <Route path="/inventory/update-stock" element={protectedPage(renderUpdateStockPage())} />
      <Route path="/analytics" element={protectedPage(renderSalesPage())} />
      <Route
        path="/help"
        element={protectedPage(renderDashboardPage(
          'help',
          <HelpSupport language={language} />,
        ))}
      />
      <Route
        path="/settings"
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
    </Routes>
  )
}

export default App
