function PlaceholderPage({ title }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white py-20 text-center">
      <h2 className="text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">This page is coming soon.</p>
    </div>
  )
}

export default PlaceholderPage