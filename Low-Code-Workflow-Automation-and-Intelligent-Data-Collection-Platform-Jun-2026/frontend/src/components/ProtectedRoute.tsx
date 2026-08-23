import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const { t } = useTranslation()
  if (loading)
  return <div className="flex items-center justify-center h-screen text-gray-500">{t('common.loading','Loading…')}</div>
  return user ? <Outlet /> : <Navigate to="/" replace />
}

export function AdminRoute() {
  const { user, loading } = useAuth()
  const { t } = useTranslation()
  if (loading)
  return <div className="flex items-center justify-center h-screen text-gray-500">{t('common.loading','Loading…')}</div>
  if (!user)
  return <Navigate to="/" replace />
  if (!user.is_superuser)
  return <Navigate to="/dashboard" replace />
  return <Outlet />
}
