import { apiRequest } from './apiClient'

export const SUPPORTED_PERIODS = ['last7', 'last30', 'last90', 'thisMonth']

// Existing automatic dashboard insights.
// Do not change this endpoint.
export function getDashboardInsights(period) {
  return apiRequest('/insights/ask', {
    method: 'POST',
    body: {
      mode: 'dashboard',
      period,
    },
  })
}

// Conversational questions go through the Orchestrator.
export async function askInsightsQuestion(question) {
  const result = await apiRequest('/assistant/message', {
    method: 'POST',
    body: {
      message: question.trim(),
    },
  })

  if (!result?.reply) {
    throw new Error('The assistant returned an empty response.')
  }

  // Adapt the Orchestrator response to the existing
  // AiInsights.jsx Answer component.
  return {
    summary: result.reply,
    insights: [],
    used_fallback: false,
    route: result.route,
    language: result.language,
  }
}