import { useEffect, useState } from 'react'
import { InventoryContext } from './contextValues'
import { initialProducts } from '../data/products'
import { getStockStatus } from '../utils/inventoryUtils'

const STORAGE_KEY = 'bizpilot-products'

function loadProducts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : initialProducts
  } catch (error) {
    console.error('Unable to read products from local storage.', error)
    return initialProducts
  }
}

function needsAttention(product) {
  const status = getStockStatus(product)
  return status === 'low-stock' || status === 'out-of-stock'
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function InventoryProvider({ children }) {
  const [products, setProducts] = useState(loadProducts)
  const [stockAlert, setStockAlert] = useState(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
    } catch (error) {
      console.error('Unable to save products to local storage.', error)
    }
  }, [products])

  function alertIfWorse(before, after) {
    if (!needsAttention(after)) return
    if (before && getStockStatus(before) === getStockStatus(after)) return
    setStockAlert({ kind: 'change', items: [after] })
  }

  function addProduct(productData) {
    const product = { id: createId(), ...productData }
    setProducts((current) => [product, ...current])
    alertIfWorse(null, product)
  }

  function updateProduct(id, productData) {
    const before = products.find((product) => product.id === id)
    if (!before) return
    const after = { ...before, ...productData }
    setProducts((current) => current.map((product) => (product.id === id ? after : product)))
    alertIfWorse(before, after)
  }

  function adjustStock(id, { newQuantity, type, amount }) {
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

  function deleteProduct(id) {
    setProducts((current) => current.filter((product) => product.id !== id))
  }

  function openSummaryAlert() {
    const items = products.filter(needsAttention)
    setStockAlert(items.length > 0 ? { kind: 'summary', items } : null)
  }

  const value = {
    products,
    stockAlert,
    addProduct,
    updateProduct,
    adjustStock,
    deleteProduct,
    openSummaryAlert,
    closeStockAlert: () => setStockAlert(null),
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}
