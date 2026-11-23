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
