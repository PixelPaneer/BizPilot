import { useCallback, useContext, useEffect, useState } from 'react'
import { AuthContext, InventoryContext } from './contextValues'
import { getStockStatus } from '../utils/inventoryUtils'
import { apiRequest } from '../utils/apiClient'

// The backend returns at most 500 products per request; the page paginates and exports locally.
const PRODUCTS_PATH = '/products?limit=500'

function needsAttention(product) {
  const status = getStockStatus(product)
  return status === 'low-stock' || status === 'out-of-stock'
}

export function InventoryProvider({ children }) {
  // Products are only loaded while signed in. (Reads the auth context directly so the
  // provider also works if it is ever rendered outside an AuthProvider.)
  const isAuthenticated = Boolean(useContext(AuthContext)?.isAuthenticated)

  const [loadedProducts, setLoadedProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [stockAlert, setStockAlert] = useState(null)

  // Nothing is shown while signed out, so a later sign-in never shows another session's data.
  const products = isAuthenticated ? loadedProducts : []

  useEffect(() => {
    if (!isAuthenticated) return undefined

    let cancelled = false
    async function loadProducts() {
      try {
        const data = await apiRequest(PRODUCTS_PATH)
        if (cancelled) return
        setLoadedProducts(data.items)
        setLoadError('')
      } catch (error) {
        if (cancelled) return
        console.error('Unable to load products.', error)
        setLoadError(error.message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadProducts()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const refreshProducts = useCallback(async () => {
    const data = await apiRequest(PRODUCTS_PATH)
    setLoadedProducts(data.items)
    setLoadError('')
    return data.items
  }, [])

  function alertIfWorse(before, after) {
    if (!needsAttention(after)) return
    if (before && getStockStatus(before) === getStockStatus(after)) return
    setStockAlert({ kind: 'change', items: [after] })
  }

  function replaceProduct(updated) {
    setLoadedProducts((current) =>
      current.map((product) => (product.id === updated.id ? updated : product)),
    )
  }

  // The functions below return a promise. They throw an ApiRequestError when the server
  // rejects the change, so the pop-up that called them can show the message.
  async function addProduct(productData) {
    const product = await apiRequest('/products', { method: 'POST', body: productData })
    setLoadedProducts((current) => [product, ...current])
    alertIfWorse(null, product)
    return product
  }

  async function updateProduct(id, productData) {
    const before = products.find((product) => product.id === id)
    const product = await apiRequest(`/products/${id}`, { method: 'PATCH', body: productData })
    replaceProduct(product)
    alertIfWorse(before, product)
    return product
  }

  // The server works out the new quantity from { type, amount }.
  async function adjustStock(id, { type, amount }) {
    const before = products.find((product) => product.id === id)
    const product = await apiRequest(`/inventory/${id}`, {
      method: 'PATCH',
      body: { type, amount },
    })
    replaceProduct(product)
    alertIfWorse(before, product)
    return product
  }

  async function deleteProduct(id) {
    await apiRequest(`/products/${id}`, { method: 'DELETE' })
    setLoadedProducts((current) => current.filter((product) => product.id !== id))
  }

  // Shows every product with an active alert. Fetches fresh data, because this also runs
  // right after sign-in, before the first product load has finished.
  async function openSummaryAlert() {
    let items
    try {
      const [alerts, fresh] = await Promise.all([
        apiRequest('/inventory/alerts'),
        refreshProducts(),
      ])
      const alertedIds = new Set(alerts.items.map((alert) => alert.productId))
      items = fresh.filter((product) => alertedIds.has(product.id))
    } catch (error) {
      console.error('Unable to load stock alerts.', error)
      items = products.filter(needsAttention)
    }
    setStockAlert(items.length > 0 ? { kind: 'summary', items } : null)
  }

  const value = {
    products,
    isLoading: isAuthenticated && isLoading,
    loadError: isAuthenticated ? loadError : '',
    stockAlert,
    addProduct,
    updateProduct,
    adjustStock,
    deleteProduct,
    openSummaryAlert,
    refreshProducts,
    closeStockAlert: () => setStockAlert(null),
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}
