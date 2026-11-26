// Talks to the Node backend: POST /api/v1/insights/ask (Node forwards it to the AI Insights Agent).

const API_URL = '/api/v1/insights/ask'

// Periods the AI endpoint understands. A custom date range is not supported by it.
export const SUPPORTED_PERIODS = ['last7', 'last30', 'last90', 'thisMonth']

function getAccessToken() {
  // TODO: replace with the app's real sign-in token source (the merged frontend's auth helper).
  return localStorage.getItem('accessToken')
}

async function post(body) {
  const token = getAccessToken()
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || `Request failed (${response.status})`)
  }

  // { mode, period, summary, insights: [{ title, observation, recommendation }], used_fallback }
  return payload.data
}

export function getDashboardInsights(period) {
  return post({ mode: 'dashboard', period })
}

export function askInsightsQuestion(period, question) {
  return post({ mode: 'question', period, question: question.trim() })
}