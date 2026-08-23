import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, FileText, BarChart2, Clock,
  User, Shield, LogOut, ChevronRight, Layers, Search, Menu,
} from 'lucide-react'
import InstallPWA from './InstallPWA'

export default function Layout() {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const handleLogout = async () => {
    await logout()
    toast.success(t('user.loggedOut'))
    navigate('/login')
  }

  // Base nav items — every authenticated user sees these
  const navItems = [
    { to: '/dashboard', label: t('nav.dashboard'),    icon: LayoutDashboard },
    { to: '/browse',    label: t('nav.browse'),       icon: Search },
    { to: '/profile',   label: t('nav.profile'),      icon: User },
  ]

  // Admin-only nav items (forms & scheduling are admin features)
  const adminItems = [
    { to: '/forms',     label: t('nav.myForms'),      icon: FileText },
    { to: '/schedules', label: t('nav.schedules'),    icon: Clock },
    { to: '/analytics', label: t('nav.analytics'),   icon: BarChart2 },
    { to: '/admin',     label: t('nav.adminPanel'),  icon: Shield },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 bg-black/30 transition-opacity md:hidden ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 md:static md:translate-x-0 ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200 md:hidden">
          <div className="flex items-center gap-2">
            <div className="bg-primary-600 p-1.5 rounded-lg">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm leading-tight">
              {t('app.title')}
            </span>
          </div>
          <button
            type="button"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
            onClick={() => setMobileOpen(false)}
            aria-label={t('sidebar.close')}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {/* Logo */}
        <div className="hidden md:block p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="bg-primary-600 p-1.5 rounded-lg">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm leading-tight">
              {t('app.title')}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to} to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
            </NavLink>
          ))}

          {/* Admin-only section */}
          {user?.is_superuser && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('sidebar.admin')}</p>
              </div>
              {adminItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to} to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                  <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm shrink-0">
              {(user?.full_name || user?.email || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.full_name || t('user.defaultName')}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title={t('user.logoutTitle')}
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* PWA install button (shows when beforeinstallprompt is available) */}
              <InstallPWA />

            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="page-container">
          <div className="flex items-center justify-between gap-4 pb-4 md:hidden">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-4 h-4" />
              {t('sidebar.menu', 'Menu')}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              onClick={async () => {
                await logout()
                toast.success(t('user.loggedOut'))
                navigate('/login')
              }}
            >
              <LogOut className="w-4 h-4" />
              {t('user.logout', 'Logout')}
            </button>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
