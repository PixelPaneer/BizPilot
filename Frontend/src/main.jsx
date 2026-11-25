import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { InventoryProvider } from './context/InventoryContext'
import { ProfileProvider } from './context/ProfileContext'
import { initializeTheme } from './utils/theme'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App.jsx'

initializeTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <InventoryProvider>
            <App />
          </InventoryProvider>
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
