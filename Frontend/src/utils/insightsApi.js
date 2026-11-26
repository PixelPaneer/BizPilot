const DASHBOARD_API_URL = '/api/v1/insights/ask';
const ASSISTANT_API_URL = '/api/v1/assistant/message';

// Periods supported by the dashboard Insights API.
export const SUPPORTED_PERIODS = [
  'last7',
  'last30',
  'last90',
  'thisMonth',
];

function getAccessToken() {
  return localStorage.getItem('accessToken');
}

async function post(url, body) {
  const token = getAccessToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new Error(
      payload?.message || `Request failed (${response.status})`
    );
  }

  return payload.data;
}

// Existing automatic dashboard insights.
// Do not change this endpoint.
export function getDashboardInsights(period) {
  return post(DASHBOARD_API_URL, {
    mode: 'dashboard',
    period,
  });
}

// Conversational questions go through the Orchestrator.
export async function askInsightsQuestion(period, question) {
  const result = await post(ASSISTANT_API_URL, {
    message: question.trim(),
  });

  if (!result?.reply) {
    throw new Error('The assistant returned an empty response.');
  }

  // Adapt the Orchestrator response to the existing
  // AiInsights.jsx Answer component.
  return {
    summary: result.reply,
    insights: [],
    used_fallback: false,
    route: result.route,
    language: result.language,
  };
}