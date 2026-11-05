import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, useInventory } from './context/contextValues'
import ProtectedRoute from './context/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import DashboardHeader from './components/DashboardHeader'
import DashboardSidebar from './components/DashboardSidebar'
import HelpSupport from './components/settings/HelpSupport'
import SettingsPage from './components/settings/SettingsPage'
import Header from './components/Header'
import InventorySummary from './components/InventorySummary'
import LowStockAlertModal from './components/LowStockAlertModal'
import NotFoundPage from './components/NotFoundPage'
import ProductInventory from './components/ProductInventory'
import Sidebar from './components/Sidebar'
import SignIn from './SignIn'
import { translations } from './context/language'
import { currentUser } from './data/user'
import { pages } from './data/pages'
import { getStockStatus, getGreeting } from './utils/inventoryUtils'

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
  const { isAuthenticated, signIn, signOut } = useAuth()
  const {
    products,
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

  function renderDashboardPage(content) {
    const alertCount = products.filter(needsAttention).length

    return (
      <div className={`app ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <DashboardSidebar open={isSidebarOpen} onNavigate={() => setIsSidebarOpen(false)} />
        <div className="main">
          <DashboardHeader
            onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
            sidebarOpen={isSidebarOpen}
            period={period}
            onPeriodChange={setPeriod}
            alertCount={alertCount}
            onOpenAlerts={openSummaryAlert}
            onSignOut={handleSignOut}
          />
          <main className="content">{content}</main>
        </div>
        {stockAlert && (
          <LowStockAlertModal
            alert={stockAlert}
            onClose={closeStockAlert}
            onViewInventory={() => {
              closeStockAlert()
              handleNavigate('inventory')
            }}
          />
        )}
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
          onOpenAlerts={openSummaryAlert}
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
              onAddProduct={addProduct}
              onUpdateProduct={updateProduct}
              onAdjustStock={adjustStock}
              onDeleteProduct={deleteProduct}
            />
          </div>
        </main>
        {stockAlert && (
          <LowStockAlertModal
            alert={stockAlert}
            onClose={closeStockAlert}
            onViewInventory={() => {
              closeStockAlert()
              handleNavigate('inventory')
            }}
          />
        )}
      </div>
    )
  }

  function renderSalesPage() {
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
          onOpenAlerts={openSummaryAlert}
          onSignOut={handleSignOut}
        />
        <Sidebar
          activePage="analytics"
          onNavigate={handleNavigate}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
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
        {stockAlert && (
          <LowStockAlertModal
            alert={stockAlert}
            onClose={closeStockAlert}
            onViewInventory={() => {
              closeStockAlert()
              handleNavigate('inventory')
            }}
          />
        )}
      </div>
    )
  }

  const protectedPage = (element) => <ProtectedRoute>{element}</ProtectedRoute>

  return (
    <Routes>
      <Route path="/signIn" element={<SignIn onSignIn={handleSignIn} />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={protectedPage(renderDashboardPage(<Dashboard period={period} />))} />
      <Route path="/inventory" element={protectedPage(renderInventoryPage())} />
      <Route path="/analytics" element={protectedPage(renderSalesPage())} />
      <Route
        path="/help"
        element={protectedPage(renderDashboardPage(
          <HelpSupport language={language} />,
        ))}
      />
      <Route
        path="/settings"
        element={protectedPage(renderDashboardPage(
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
