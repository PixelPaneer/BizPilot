
const API_BASE = '/api/v1/insights'

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || `Request failed (${response.status})`
    )
  }

  return data
}

export function getInsights(filters = {}) {
  const params = new URLSearchParams()

  if (filters.type) params.set('type', filters.type)
  if (filters.status) params.set('status', filters.status)

  const query = params.toString()

  return request(`${API_BASE}${query ? `?${query}` : ''}`)
}

export function getInsightById(id) {
  if (!id) throw new Error('Insight ID is required')

  return request(`${API_BASE}/${encodeURIComponent(id)}`)
}

export function sendInsightInteraction(id, interaction) {
  if (!id) throw new Error('Insight ID is required')

  const allowed = ['VIEWED', 'DISMISSED', 'ACTED']

  if (!allowed.includes(interaction)) {
    throw new Error('Invalid insight interaction')
  }

  return request(`${API_BASE}/${encodeURIComponent(id)}/interactions`, {
    method: 'POST',
    body: JSON.stringify({ interaction }),
  })
}

export function refreshInsights() {
  return request(`${API_BASE}/refresh`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
