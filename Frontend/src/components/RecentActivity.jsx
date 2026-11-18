import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUp, Box, FileText } from 'lucide-react'
import { timeAgo } from '../utils/inventoryUtils'

const TYPE_ICON = {
  stock_added: { Icon: ArrowUp, tone: 'green' },
  stock_removed: { Icon: ArrowDown, tone: 'red' },
  product_added: { Icon: Box, tone: 'gold' },
  bill_generated: { Icon: FileText, tone: 'sage' },
}

export default function RecentActivity({ activities }) {
  return (
    <section className="card">
      <div className="card__head">
        <div>
          <h2>Recent Activity</h2>
          <p>Latest updates in your business</p>
        </div>
        <Link to="/inventory" className="link-more">
          View all <ArrowRight size={14} />
        </Link>
      </div>

      <ul className="activity-list">
        {activities.map((a) => {
          const { Icon, tone } = TYPE_ICON[a.type] || TYPE_ICON.product_added
          return (
            <li key={a.id} className="activity">
              <span className={`activity__icon tone--${tone}`}>
                <Icon size={16} strokeWidth={2.3} />
              </span>
              <span className="activity__text">
                <strong>{a.title}</strong>
                <span>{a.detail}</span>
              </span>
              <time className="activity__time">{timeAgo(a.createdAt)}</time>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
