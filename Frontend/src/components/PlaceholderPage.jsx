import { Link } from 'react-router-dom'
import { Construction } from 'lucide-react'

export default function PlaceholderPage({ title, text }) {
  return (
    <section className="card placeholder">
      <span className="placeholder__icon">
        <Construction size={28} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <p className="placeholder__soon">This page is coming soon.</p>
      <Link to="/" className="btn-primary">Back to Dashboard</Link>
    </section>
  )
}
