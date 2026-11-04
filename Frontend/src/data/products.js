// Fallback catalog used when the API is not reachable.
// 128 products -> 117 in stock, 8 low stock, 3 out of stock.
const BASE_NAMES = [
  'Parle-G', 'Amul Milk 1L', 'Aashirvaad Atta', 'Maggi Noodles',
  'Tata Salt', 'Fortune Oil', 'Britannia Bread', 'Surf Excel',
  'Colgate Paste', 'Dettol Soap', 'Red Label Tea', 'Nescafe Classic',
  'Basmati Rice', 'Toor Dal', 'Sugar 1kg', 'Haldiram Bhujia',
  'Kurkure', 'Lays Chips', 'Coca-Cola 750ml', 'Frooti Mango',
  'Amul Butter', 'Amul Cheese', 'Good Day Biscuits', 'Oreo',
  'Vim Dishwash', 'Harpic', 'Lifebuoy', 'Clinic Plus Shampoo',
  'Everest Masala', 'MDH Chat Masala', 'Kissan Ketchup', 'Bournvita',
]
const PACKS = ['', ' (Pack of 2)', ' (Family Pack)', ' (Value Pack)']

const LOW_STOCK_INDEXES = [3, 19, 33, 47, 58, 71, 90, 105]
const OUT_OF_STOCK_INDEXES = [12, 64, 99]

const products = Array.from({ length: 128 }, (_, i) => {
  const name = BASE_NAMES[i % BASE_NAMES.length] + PACKS[Math.floor(i / BASE_NAMES.length)]
  const reorderLevel = 20
  let stock = 40 + ((i * 13) % 160)
  if (i === 0) stock = 200
  if (i === 2) stock = 80
  if (LOW_STOCK_INDEXES.includes(i)) stock = i === 3 ? 15 : 5 + (i % 14)
  if (OUT_OF_STOCK_INDEXES.includes(i)) stock = 0

  return {
    id: i + 1,
    name,
    price: 20 + ((i * 7) % 180),
    stock,
    reorderLevel,
  }
})

export default products
