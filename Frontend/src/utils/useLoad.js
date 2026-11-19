import { useEffect, useState } from 'react'

// Runs `load` (a stable function that returns a promise) when the component appears and again
// each time `load` changes or `retry` is called. Returns { isLoading, error, value, retry }.
export function useLoad(load) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false
    load()
      .then((value) => {
        if (!cancelled) setResult({ attempt, value })
      })
      .catch((error) => {
        if (!cancelled) setResult({ attempt, error: error.message || 'Something went wrong.' })
      })
    return () => {
      cancelled = true
    }
  }, [load, attempt])

  // While a newer request is running, the last good answer stays on screen (so a chart does
  // not blink away when its date range changes). Before any answer, or after a failure that
  // is being retried, `isLoading` is true.
  const isCurrent = result?.attempt === attempt
  const hasValue = result !== null && result.error === undefined
  return {
    isLoading: result === null || (!isCurrent && !hasValue),
    error: isCurrent ? (result.error ?? null) : null,
    value: hasValue ? result.value : null,
    retry: () => setAttempt((count) => count + 1),
  }
}
