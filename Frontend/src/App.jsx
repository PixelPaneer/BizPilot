import { useState, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import PlaceholderPage from './components/PlaceholderPage'
import Dashboard from './pages/Dashboard'


export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [period, setPeriod] = useState('month')

  // Close the sidebar on any click/tap outside it.
  // The burger button is excluded so it can still toggle the sidebar.
  useEffect(() => {
    if (!sidebarOpen) return
    const handler = (e) => {
      if (e.target.closest('.sidebar, .burger')) return
      setSidebarOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [sidebarOpen])

  return (
    <div className={`app ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      <div className="main">
        <Header
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
          period={period}
          onPeriodChange={setPeriod}
        />
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard period={period} />} />
            <Route
              path="/inventory"
              element={<PlaceholderPage title="Inventory" text="Manage your products and stock levels here." />}
            />
            <Route
              path="/analytics"
              element={<PlaceholderPage title="Business Analytics" text="Detailed sales and business insights will appear here." />}
            />
            <Route
              path="/settings"
              element={<PlaceholderPage title="Settings" text="Configure your BizPilot account and preferences." />}
            />
            <Route path="*" element={<PlaceholderPage title="Page not found" text="That page doesn't exist." />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
