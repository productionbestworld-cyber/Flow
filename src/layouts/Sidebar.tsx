import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, ClipboardList, Wind,
  Printer, Warehouse, TrendingUp, Receipt,
  Settings, ChevronLeft, ChevronRight, LogOut,
  Cog, Activity,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../lib/AuthContext'
import { useUiStore } from '../store/uiStore'
import type { UserRole } from '../types'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { to: '/',           label: 'Dashboard',   icon: <LayoutDashboard size={18} />, roles: ['admin','planner','operator','warehouse','sales'] },
  { to: '/sale-order', label: 'Sale Order',  icon: <ShoppingCart size={18} />,   roles: ['admin','sales'] },
  { to: '/planning',   label: 'Planning',    icon: <ClipboardList size={18} />,  roles: ['admin','planner'] },
  { to: '/extrusion',  label: 'Blow',        icon: <Wind size={18} />,           roles: ['admin','operator'] },
  { to: '/printing',   label: 'Printing',    icon: <Printer size={18} />,        roles: ['admin','operator'] },
  { to: '/grinding',   label: 'Grinding',    icon: <Cog size={18} />,            roles: ['admin','operator'] },
  { to: '/warehouse',  label: 'คลังสินค้า',  icon: <Warehouse size={18} />,      roles: ['admin','warehouse'] },
  { to: '/sales',      label: 'Sales',       icon: <TrendingUp size={18} />,     roles: ['admin','sales'] },
  { to: '/billing',    label: 'Billing',     icon: <Receipt size={18} />,        roles: ['admin','sales'] },
  { to: '/activity',   label: 'Activity Log', icon: <Activity size={18} />,       roles: ['admin','planner','warehouse','sales','operator'] },
  { to: '/settings',   label: 'ตั้งค่า',     icon: <Settings size={18} />,       roles: ['admin'] },
]

const roleColors: Record<UserRole, string> = {
  admin:     'bg-purple-500/20 text-purple-300',
  planner:   'bg-blue-500/20 text-blue-300',
  operator:  'bg-green-500/20 text-green-300',
  warehouse: 'bg-yellow-500/20 text-yellow-300',
  sales:     'bg-pink-500/20 text-pink-300',
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Admin', planner: 'Planner', operator: 'Operator',
  warehouse: 'Warehouse', sales: 'Sales',
}

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const { sidebarCollapsed, toggleSidebar } = useUiStore()

  const visibleItems = navItems.filter(
    (item) => user && item.roles.includes(user.role)
  )

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-slate-900 border-r border-slate-800 transition-all duration-300 shrink-0',
      sidebarCollapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-slate-800">
        {!sidebarCollapsed && (
          <span className="font-bold text-white text-sm tracking-wide">
            FlowPro <span className="text-brand-500">v2</span>
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="ml-auto p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => cn(
              'flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-colors',
              isActive
                ? 'bg-brand-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            <span className="shrink-0">{item.icon}</span>
            {!sidebarCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-slate-800 p-3">
        {user && (
          <div className={cn('flex items-center gap-3', sidebarCollapsed && 'justify-center')}>
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.full_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{user.full_name}</p>
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full', roleColors[user.role])}>
                  {roleLabels[user.role]}
                </span>
              </div>
            )}
            {!sidebarCollapsed && (
              <button
                onClick={signOut}
                className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                title="ออกจากระบบ"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
