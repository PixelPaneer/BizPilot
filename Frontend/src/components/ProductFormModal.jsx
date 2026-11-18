import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { units, OTHER_CATEGORY } from '../data/products'

const emptyForm = {
  name: '',
  category: '',
  customCategory: '',
  price: '',
  unit: '',
  quantity: '',
  lowStockThreshold: '',
}

const inputClasses =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-forest focus:outline-none'

// "  fresh   snacks " -> "fresh snacks"
function cleanName(text) {
  return text.trim().replace(/\s+/g, ' ')
}

// Turns a saved product (numbers) into form values (text).
function productToForm(product) {
  return {
    name: product.name,
    category: product.category,
    customCategory: '',
    price: String(product.price),
    unit: product.unit,
    quantity: String(product.quantity),
    lowStockThreshold: String(product.lowStockThreshold),
  }
}

// Works out the final category name to save.
function resolveCategory(form, categories) {
  if (form.category !== OTHER_CATEGORY) return form.category

  const typed = cleanName(form.customCategory)
  // If it matches an existing category (ignoring letter case), reuse that spelling.
  const existing = [...categories, OTHER_CATEGORY].find(
    (name) => name.toLowerCase() === typed.toLowerCase(),
  )
  return existing ?? typed
}

// Returns an object of error messages. Empty object = everything is valid.
function validate(form) {
  const errors = {}

  if (!form.name.trim()) errors.name = 'Product name is required.'

  if (!form.category) {
    errors.category = 'Please choose a category.'
  } else if (form.category === OTHER_CATEGORY) {
    const typed = cleanName(form.customCategory)
    if (!typed) errors.customCategory = 'Enter a name for the new category.'
    else if (typed.length > 30) errors.customCategory = 'Keep the name under 30 characters.'
  }

  if (!form.unit) errors.unit = 'Please choose a unit.'

  const price = Number(form.price)
  if (form.price.trim() === '') {
    errors.price = 'Selling price is required.'
  } else if (!Number.isFinite(price) || price < 0) {
    errors.price = 'Enter a valid price (0 or more).'
  }

  if (!/^\d+$/.test(form.quantity.trim())) {
    errors.quantity = 'Enter a whole number (0 or more).'
  }
  if (!/^\d+$/.test(form.lowStockThreshold.trim())) {
    errors.lowStockThreshold = 'Enter a whole number (0 or more).'
  }

  return errors
}

function Field({ id, label, error, hint, className = '', children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger-text">
          {error}
        </p>
      )}
    </div>
  )
}

// If "product" is given, the form is in Edit mode. Otherwise it is in Add mode.
// "categories" is the list of categories currently in use (built-in + custom).
function ProductFormModal({ product, categories = [], onSave, onClose }) {
  const isEditing = Boolean(product)
  const [form, setForm] = useState(isEditing ? productToForm(product) : emptyForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleChange(event) {
    const { name, value } = event.target
    setForm({ ...form, [name]: value })
    setErrors({ ...errors, [name]: undefined })
  }

  function handleSubmit(event) {
    event.preventDefault()

    const foundErrors = validate(form)
    if (Object.keys(foundErrors).length > 0) {
      setErrors(foundErrors)
      return
    }

    onSave({
      name: form.name.trim(),
      category: resolveCategory(form, categories),
      price: Number(form.price),
      unit: form.unit,
      quantity: Number(form.quantity),
      lowStockThreshold: Number(form.lowStockThreshold),
    })
  }

  const title = isEditing ? 'Edit Product' : 'Add Product'
  const listedCategories = categories.filter((name) => name !== OTHER_CATEGORY)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="product-form-title" className="text-xl font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-sage-light hover:text-forest"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Product Name" error={errors.name} className="sm:col-span-2">
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Fresh Milk"
              aria-invalid={Boolean(errors.name)}
              className={inputClasses}
            />
          </Field>

          <Field id="category" label="Category" error={errors.category}>
            <select
              id="category"
              name="category"
              value={form.category}
              onChange={handleChange}
              aria-invalid={Boolean(errors.category)}
              className={inputClasses}
            >
              <option value="">Select category</option>
              {listedCategories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value={OTHER_CATEGORY}>Other (add new category)</option>
            </select>
          </Field>

          <Field id="unit" label="Unit" error={errors.unit}>
            <select
              id="unit"
              name="unit"
              value={form.unit}
              onChange={handleChange}
              aria-invalid={Boolean(errors.unit)}
              className={inputClasses}
            >
              <option value="">Select unit</option>
              {units.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>

          {/* Only appears when "Other" is chosen */}
          {form.category === OTHER_CATEGORY && (
            <Field
              id="customCategory"
              label="New Category Name"
              error={errors.customCategory}
              hint="This category will be added to your category list and filters."
              className="sm:col-span-2"
            >
              <input
                id="customCategory"
                name="customCategory"
                type="text"
                maxLength={30}
                value={form.customCategory}
                onChange={handleChange}
                placeholder="e.g. Snacks"
                autoFocus
                aria-invalid={Boolean(errors.customCategory)}
                className={inputClasses}
              />
            </Field>
          )}

          <Field id="price" label="Selling Price (₹)" error={errors.price}>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={handleChange}
              placeholder="e.g. 56"
              aria-invalid={Boolean(errors.price)}
              className={inputClasses}
            />
          </Field>

          <Field id="quantity" label="Available Quantity" error={errors.quantity}>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="0"
              step="1"
              value={form.quantity}
              onChange={handleChange}
              placeholder="e.g. 120"
              aria-invalid={Boolean(errors.quantity)}
              className={inputClasses}
            />
          </Field>

          <Field
            id="lowStockThreshold"
            label="Low-Stock Threshold"
            error={errors.lowStockThreshold}
            hint="The product is marked Low Stock when its quantity is at or below this number."
            className="sm:col-span-2"
          >
            <input
              id="lowStockThreshold"
              name="lowStockThreshold"
              type="number"
              min="0"
              step="1"
              value={form.lowStockThreshold}
              onChange={handleChange}
              placeholder="e.g. 50"
              aria-invalid={Boolean(errors.lowStockThreshold)}
              className={inputClasses}
            />
          </Field>

          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-line px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-deep"
            >
              {isEditing ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProductFormModal