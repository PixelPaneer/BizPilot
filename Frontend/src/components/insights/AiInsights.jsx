import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleAlert, RefreshCw, Send, Sparkles } from 'lucide-react'
import {
  SUPPORTED_PERIODS,
  askInsightsQuestion,
  getDashboardInsights,
} from '../../utils/insightsApi'
import { Card, CardHeader } from '../sales/SalesUI'

const MAX_QUESTION = 500
const SUGGESTIONS = [
  'Which products earned the most revenue?',
  'What is selling slowly and what should I do?',
  'How does revenue compare to the previous period?',
]

function InsightList({ insights }) {
  if (!insights?.length) return null
  return (
    <ul className="mt-4 grid gap-3 md:grid-cols-2">
      {insights.map((item, index) => (
        <li key={index} className="rounded-2xl border border-[#EAE4D8] bg-[#FBFAF6] p-4">
          <h3 className="text-sm font-semibold text-[#1F2D27]">{item.title}</h3>
          <p className="mt-1 text-sm text-[#5E655F]">{item.observation}</p>
          <p className="mt-2 text-sm font-medium text-[#244F3D]">{item.recommendation}</p>
        </li>
      ))}
    </ul>
  )
}

function Answer({ result }) {
  return (
    <div>
      <p className="text-[15px] leading-relaxed text-[#1F2D27]">{result.summary}</p>
      <InsightList insights={result.insights} />
      {result.used_fallback && (
        <p className="mt-3 text-xs text-[#7A8079]">
          Basic summary shown because the AI assistant was unavailable.
        </p>
      )}
    </div>
  )
}

function ErrorNote({ message, onRetry }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#FBEDE8] p-4 text-sm text-[#8A3B25]">
      <CircleAlert className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline">
          Try again
        </button>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true">
      <div className="h-4 w-3/4 rounded bg-[#EAE4D8]" />
      <div className="h-4 w-1/2 rounded bg-[#EAE4D8]" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-24 rounded-2xl bg-[#F1ECE0]" />
        <div className="h-24 rounded-2xl bg-[#F1ECE0]" />
      </div>
    </div>
  )
}

export default function AiInsights({ period }) {
  const supported = SUPPORTED_PERIODS.includes(period)
  const cache = useRef(new Map())
  const dashboardRequest = useRef(0)
  const questionRequest = useRef(0)

  const [dashboard, setDashboard] = useState({ status: 'idle', data: null, error: '' })
  const [question, setQuestion] = useState('')
  const [qa, setQa] = useState({ status: 'idle', asked: '', data: null, error: '' })

  const loadDashboard = useCallback(
    async (force = false) => {
      if (!supported) return
      if (!force && cache.current.has(period)) {
        setDashboard({ status: 'done', data: cache.current.get(period), error: '' })
        return
      }
      const id = ++dashboardRequest.current
      setDashboard({ status: 'loading', data: null, error: '' })
      try {
        const data = await getDashboardInsights(period)
        if (id !== dashboardRequest.current) return
        cache.current.set(period, data)
        setDashboard({ status: 'done', data, error: '' })
      } catch (err) {
        if (id !== dashboardRequest.current) return
        setDashboard({ status: 'error', data: null, error: err.message })
      }
    },
    [period, supported]
  )

  // Load when the page opens and whenever the page's date range changes.
  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const ask = async (text) => {
    const asked = text.trim()
    if (!asked || !supported) return
    const id = ++questionRequest.current
    setQa({ status: 'loading', asked, data: null, error: '' })
    try {
      const data = await askInsightsQuestion(asked)
      if (id !== questionRequest.current) return
      setQa({ status: 'done', asked, data, error: '' })
    } catch (err) {
      if (id !== questionRequest.current) return
      setQa({ status: 'error', asked, data: null, error: err.message })
    }
  }

  const onSubmit = (event) => {
    event.preventDefault()
    ask(question)
  }

  const busy = qa.status === 'loading'

  return (
    <Card>
      <CardHeader
        icon={Sparkles}
        title="AI Business Insights"
        subtitle="Explained from your sales data for the selected period."
        action={
          supported && (
            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={dashboard.status === 'loading'}
              className="inline-flex items-center gap-2 rounded-xl border border-[#EAE4D8] px-3 py-2 text-sm font-medium text-[#244F3D] hover:bg-[#F4F1E8] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${dashboard.status === 'loading' ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          )
        }
      />

      {!supported ? (
        <p className="text-sm text-[#7A8079]">
          AI insights are available for the preset ranges (7, 30, 90 days or this month). Pick one
          above to see them.
        </p>
      ) : (
        <>
          {dashboard.status === 'loading' && <Skeleton />}
          {dashboard.status === 'error' && (
            <ErrorNote message={dashboard.error} onRetry={() => loadDashboard(true)} />
          )}
          {dashboard.status === 'done' && <Answer result={dashboard.data} />}

          <div className="mt-6 border-t border-[#EAE4D8] pt-5">
            <h3 className="text-sm font-semibold text-[#1F2D27]">Ask about your business</h3>
            <form onSubmit={onSubmit} className="mt-3 flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={MAX_QUESTION}
                placeholder="e.g. Which category should I stock more of?"
                className="min-w-0 flex-1 rounded-xl border border-[#EAE4D8] bg-white px-4 py-2.5 text-sm text-[#1F2D27] outline-none focus:border-[#244F3D]"
              />
              <button
                type="submit"
                disabled={busy || !question.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#244F3D] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Ask
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((text) => (
                <button
                  key={text}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setQuestion(text)
                    ask(text)
                  }}
                  className="rounded-full bg-[#E8EFE6] px-3 py-1.5 text-xs font-medium text-[#244F3D] hover:bg-[#DCE7D8] disabled:opacity-50"
                >
                  {text}
                </button>
              ))}
            </div>

            {qa.status !== 'idle' && (
              <div className="mt-4 rounded-2xl border border-[#EAE4D8] p-4">
                <p className="mb-2 text-xs font-medium text-[#7A8079]">You asked: {qa.asked}</p>
                {qa.status === 'loading' && <Skeleton />}
                {qa.status === 'error' && (
                  <ErrorNote message={qa.error} onRetry={() => ask(qa.asked)} />
                )}
                {qa.status === 'done' && <Answer result={qa.data} />}
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  )
}