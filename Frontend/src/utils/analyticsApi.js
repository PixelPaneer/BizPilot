// The Analytics page's calls to the backend (/api/v1/analytics/*).
import { useCallback } from 'react'
import { apiRequest } from './apiClient'
import { useLoad } from './useLoad'

// The date filter's choice as the query string the API expects. The presets (last7, last30,
// last90, thisMonth) are sent by name; a custom range sends its two dates.
export function rangeQuery({ preset, customStart, customEnd }) {
  const params = new URLSearchParams()
  if (preset === 'custom' && customStart && customEnd) {
    const [startDate, endDate] =
      customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart]
    params.set('period', 'custom')
    params.set('startDate', startDate)
    params.set('endDate', endDate)
  } else {
    params.set('period', preset === 'custom' ? 'last30' : preset)
  }
  return params.toString()
}

// Loads one analytics endpoint for a date range, and again whenever the range changes.
// `pick` (a function defined outside the component) chooses the part of the response to keep.
export function useAnalytics(endpoint, dateRange, pick) {
  const query = rangeQuery(dateRange)
  const load = useCallback(
    () => apiRequest(`/analytics/${endpoint}?${query}`).then(pick),
    [endpoint, query, pick],
  )
  return useLoad(load)
}
