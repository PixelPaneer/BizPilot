import { useEffect, useRef, useState } from 'react'
import { Calendar, Check, ChevronDown } from 'lucide-react'
import { DATE_PRESETS, getRangeLabel, toInputDate } from '../../utils/salesUtils'

export default function DateRangeFilter({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const choosePreset = (preset) => {
    if (preset === 'custom') {
      const today = new Date()
      const monthAgo = new Date()
      monthAgo.setDate(today.getDate() - 29)
      onChange({
        preset: 'custom',
        customStart: value.customStart || toInputDate(monthAgo),
        customEnd: value.customEnd || toInputDate(today),
      })
      return // keep the panel open so dates can be picked
    }
    onChange({ ...value, preset })
    setOpen(false)
  }

  const setCustomDate = (field, newValue) =>
    onChange({ ...value, preset: 'custom', [field]: newValue })

  return (
    <div ref={wrapperRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="sales-date-trigger flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition-colors sm:w-auto"
      >
        <span className="flex items-center gap-2.5">
          <Calendar className="sales-date-icon h-4 w-4" />
          {getRangeLabel(value)}
        </span>
        <ChevronDown className={`sales-muted h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="sales-date-menu absolute right-0 z-30 mt-2 w-full rounded-2xl border p-2 sm:w-72">
          {DATE_PRESETS.map((preset) => {
            const active = value.preset === preset.value
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => choosePreset(preset.value)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  active ? 'sales-option-active font-medium' : 'sales-option'
                }`}
              >
                {preset.label}
                {active && <Check className="h-4 w-4" />}
              </button>
            )
          })}

          {value.preset === 'custom' && (
            <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-2">
              <label className="sales-date-label text-xs">
                Start date
                <input
                  type="date"
                  value={value.customStart}
                  max={value.customEnd || toInputDate(new Date())}
                  onChange={(e) => setCustomDate('customStart', e.target.value)}
                  className="sales-date-input mt-1 w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2"
                />
              </label>
              <label className="sales-date-label text-xs">
                End date
                <input
                  type="date"
                  value={value.customEnd}
                  min={value.customStart}
                  max={toInputDate(new Date())}
                  onChange={(e) => setCustomDate('customEnd', e.target.value)}
                  className="sales-date-input mt-1 w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}