import { Construction } from 'lucide-react'
import { Link } from 'react-router-dom'

function PlaceholderPage({ title, text }) {
  if (text) {
    return (
      <section className="card placeholder">
        <span className="placeholder__icon"><Construction size={28} /></span>
        <h2>{title}</h2>
        <p>{text}</p>
        <p className="placeholder__soon">This page is coming soon.</p>
        <Link to="/" className="btn-primary">Back to Dashboard</Link>
      </section>
    )
  }

  return (
    <div className="rounded-2xl border border-dashed border-line bg-white py-20 text-center">
      <h2 className="text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">This page is coming soon.</p>
    </div>
  )
}

export default PlaceholderPage
