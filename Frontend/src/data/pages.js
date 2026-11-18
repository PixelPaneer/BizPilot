import { House, Package, TrendingUp, CircleHelp, Settings } from 'lucide-react'

export const pages = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: House,
    subtitle: "Here's your business overview for today.",
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    subtitle: 'Monitor stock levels and manage product inventory.',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: TrendingUp,
    subtitle: 'Detailed sales and business insights.',
  },
  {
    id: 'help',
    label: 'Help & Support',
    icon: CircleHelp,
    subtitle: 'Find answers and get in touch with support.',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    subtitle: 'Manage your business preferences.',
  },
]