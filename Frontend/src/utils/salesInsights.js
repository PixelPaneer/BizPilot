const TOP_CATEGORY_LIMIT = 5

export function getTopCategorySales(categories, metric) {
  const topCategories = [...categories]
    .filter((category) => category.category !== 'Others')
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, TOP_CATEGORY_LIMIT)
  const topCategoryNames = new Set(topCategories.map((category) => category.category))
  const otherCategories = categories.filter(
    (category) => !topCategoryNames.has(category.category),
  )

  const visibleCategories = [...topCategories]
  if (otherCategories.length > 0) {
    visibleCategories.push({
      category: 'Others',
      revenue: otherCategories.reduce((total, category) => total + category.revenue, 0),
      unitsSold: otherCategories.reduce((total, category) => total + category.unitsSold, 0),
    })
  }

  return visibleCategories
}
