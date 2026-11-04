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
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#EAE4D8] bg-white px-4 py-2.5 text-sm font-medium text-[#1F2D27] shadow-[0_1px_2px_rgba(36,79,61,0.05)] transition-colors hover:bg-[#F7F3EA] sm:w-auto"
      >
        <span className="flex items-center gap-2.5">
          <Calendar className="h-4 w-4 text-[#244F3D]" />
          {getRangeLabel(value)}
        </span>
        <ChevronDown className={`h-4 w-4 text-[#7A8079] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-full rounded-2xl border border-[#EAE4D8] bg-white p-2 shadow-[0_12px_32px_rgba(36,79,61,0.12)] sm:w-72">
          {DATE_PRESETS.map((preset) => {
            const active = value.preset === preset.value
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => choosePreset(preset.value)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  active ? 'bg-[#E8EFE6] font-medium text-[#244F3D]' : 'text-[#1F2D27] hover:bg-[#F3EFE6]'
                }`}
              >
                {preset.label}
                {active && <Check className="h-4 w-4" />}
              </button>
            )
          })}

          {value.preset === 'custom' && (
            <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-2">
              <label className="text-xs text-[#7A8079]">
                Start date
                <input
                  type="date"
                  value={value.customStart}
                  max={value.customEnd || toInputDate(new Date())}
                  onChange={(e) => setCustomDate('customStart', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#EAE4D8] px-2 py-1.5 text-sm text-[#1F2D27] focus:outline-none focus:ring-2 focus:ring-[#244F3D]/30"
                />
              </label>
              <label className="text-xs text-[#7A8079]">
                End date
                <input
                  type="date"
                  value={value.customEnd}
                  min={value.customStart}
                  max={toInputDate(new Date())}
                  onChange={(e) => setCustomDate('customEnd', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#EAE4D8] px-2 py-1.5 text-sm text-[#1F2D27] focus:outline-none focus:ring-2 focus:ring-[#244F3D]/30"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}