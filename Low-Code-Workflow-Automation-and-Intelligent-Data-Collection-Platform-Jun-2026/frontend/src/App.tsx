import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

// Apply saved theme before first render
;(() => {
  const theme = localStorage.getItem('app_theme') || 'light'
if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else if (theme === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark')
    }
  }
})()

import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'
import Layout from './components/Layout'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import DashboardPage      from './pages/DashboardPage'
import FormsPage          from './pages/FormsPage'
import BrowseFormsPage    from './pages/BrowseFormsPage'
import FormBuilderPage    from './pages/FormBuilderPage'
import SubmissionsPage    from './pages/SubmissionsPage'
import { AnalyticsDashboard } from './pages/AnalyticsPage'
import FormAnalyticsPage  from './pages/AnalyticsPage'
import SchedulesPage      from './pages/SchedulesPage'
import ProfilePage        from './pages/ProfilePage'
import PublicFormPage     from './pages/PublicFormPage'
import AdminPage          from './pages/AdminPage'
import LandingPage        from './pages/LandingPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { borderRadius: '10px', fontSize: '14px' },
            success: { duration: 3000 },
            error:   { duration: 5000 },
          }}
        />

        <Routes>
          {/* ── Public (no auth) ─────────────────────────────────────── */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/public/:uuid" element={<PublicFormPage />} />

          {/* ── Authenticated ────────────────────────────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/forms"     element={<FormsPage />} />
              <Route path="/browse"    element={<BrowseFormsPage />} />
              <Route path="/forms/:id/builder"     element={<FormBuilderPage />} />
              <Route path="/forms/:id/submissions" element={<SubmissionsPage />} />
              <Route path="/schedules" element={<SchedulesPage />} />
              <Route path="/profile"   element={<ProfilePage />} />

              {/* ── Admin-only ──────────────────────────────────────── */}
              <Route element={<AdminRoute />}>
                <Route path="/analytics"     element={<AnalyticsDashboard />} />
                <Route path="/analytics/:id" element={<FormAnalyticsPage />} />
                <Route path="/admin"         element={<AdminPage />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
