// Fallback catalog used by the dashboard when the API is not reachable.
const baseNames = [
  'Parle-G', 'Amul Milk 1L', 'Aashirvaad Atta', 'Maggi Noodles',
  'Tata Salt', 'Fortune Oil', 'Britannia Bread', 'Surf Excel',
  'Colgate Paste', 'Dettol Soap', 'Red Label Tea', 'Nescafe Classic',
  'Basmati Rice', 'Toor Dal', 'Sugar 1kg', 'Haldiram Bhujia',
  'Kurkure', 'Lays Chips', 'Coca-Cola 750ml', 'Frooti Mango',
  'Amul Butter', 'Amul Cheese', 'Good Day Biscuits', 'Oreo',
  'Vim Dishwash', 'Harpic', 'Lifebuoy', 'Clinic Plus Shampoo',
  'Everest Masala', 'MDH Chat Masala', 'Kissan Ketchup', 'Bournvita',
]
const packs = ['', ' (Pack of 2)', ' (Family Pack)', ' (Value Pack)']
const lowStockIndexes = [3, 19, 33, 47, 58, 71, 90, 105]
const outOfStockIndexes = [12, 64, 99]

const products = Array.from({ length: 128 }, (_, index) => {
  const name = baseNames[index % baseNames.length] + packs[Math.floor(index / baseNames.length)]
  const reorderLevel = 20
  let stock = 40 + ((index * 13) % 160)
  if (index === 0) stock = 200
  if (index === 2) stock = 80
  if (lowStockIndexes.includes(index)) stock = index === 3 ? 15 : 5 + (index % 14)
  if (outOfStockIndexes.includes(index)) stock = 0
  return { id: index + 1, name, price: 20 + ((index * 7) % 180), stock, reorderLevel }
})

export const initialProducts = []
export const defaultCategories = ['Fruits', 'Dairy', 'Bakery', 'Vegetables', 'Meat', 'Beverages']
export const OTHER_CATEGORY = 'Other'
export const units = ['piece', 'kg', 'g', 'L', 'ml', 'dozen', 'packet']

export default products
