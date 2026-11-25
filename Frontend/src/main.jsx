import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
<<<<<<< origin/Frontend_v2
import { AuthProvider } from './context/AuthContext'
import { InventoryProvider } from './context/InventoryContext'
import { ProfileProvider } from './context/ProfileContext'
import { initializeTheme } from './utils/theme'
=======
>>>>>>> origin/frontend-insights-anwesha
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App.jsx'

<<<<<<< origin/Frontend_v2
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
=======
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
>>>>>>> origin/frontend-insights-anwesha
    </BrowserRouter>
  </StrictMode>,
)
