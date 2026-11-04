// Fallback dashboard data (same shape as GET /api/dashboard).
// `minutesAgo` is converted to a real timestamp when used.
export const revenueByPeriod = {
  week: { amount: 31480, previous: 29150 },
  month: { amount: 124350, previous: 111027 },
  year: { amount: 1452300, previous: 1245000 },
}

export const recentActivities = [
  { id: 1, type: 'stock_added', title: 'Stock updated', detail: 'Parle-G  •  +50 units (New stock: 200)', minutesAgo: 12 },
  { id: 2, type: 'product_added', title: 'Product added', detail: 'Amul Milk 1L  •  ₹65', minutesAgo: 120 },
  { id: 3, type: 'bill_generated', title: 'Bill generated', detail: 'BIL-0018  •  5 items  •  ₹560', minutesAgo: 240 },
  { id: 4, type: 'stock_added', title: 'Stock updated', detail: 'Aashirvaad Atta  •  +20 units (New stock: 80)', minutesAgo: 300 },
  { id: 5, type: 'stock_removed', title: 'Stock updated', detail: 'Maggi Noodles  •  -10 units (New stock: 15)', minutesAgo: 360 },
]
