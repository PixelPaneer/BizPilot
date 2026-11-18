const badgeStyles = {
  'in-stock': { label: 'In Stock', classes: 'bg-sage-light text-deep' },
  'low-stock': { label: 'Low Stock', classes: 'bg-warn-bg text-warn-text' },
  'out-of-stock': { label: 'Out of Stock', classes: 'bg-danger-bg text-danger-text' },
}

function StockStatusBadge({ status }) {
  const { label, classes } = badgeStyles[status]

  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  )
}

export default StockStatusBadge