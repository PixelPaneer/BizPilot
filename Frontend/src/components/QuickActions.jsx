import { Link } from 'react-router-dom'
import { BarChart3, ChevronRight, Database, FileText, Plus } from 'lucide-react'

const actions = [
  { to: '/inventory', title: 'Add Product', text: 'Add a new product to your catalog', icon: Plus, tone: 'green' },
  { to: '/inventory', title: 'Update Stock', text: 'Record stock in / out for your products', icon: Database, tone: 'gold' },
  { to: '/inventory', title: 'Create Bill / PDF', text: 'Generate a bill for a sale', icon: FileText, tone: 'sage' },
  { to: '/analytics', title: 'View Analytics', text: 'Detailed sales and business insights', icon: BarChart3, tone: 'amber' },
]

export default function QuickActions() {
  return (
    <section className="card">
      <div className="card__head">
        <div>
          <h2>Quick Actions</h2>
          <p>Common tasks for your business</p>
        </div>
      </div>

      <div className="quick-grid">
        {actions.map(({ to, title, text, icon: Icon, tone }) => (
          <Link key={title} to={to} className={`quick tone-bg--${tone}`}>
            <span className={`quick__icon tone--${tone}`}>
              <Icon size={20} />
            </span>
            <span className="quick__text">
              <strong>{title}</strong>
              <small>{text}</small>
            </span>
            <ChevronRight size={16} className="quick__chev" />
          </Link>
        ))}
      </div>
    </section>
  )
}
