import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { analyticsApi, schedulesApi, formsApi, profileApi } from '../lib/apiModules'
import type { EnhancedDashboardAnalytics, UpcomingFormOut, FormOut, UserSubmissionOut } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import {
  FileText, Users, Send, Search, Shield, CalendarClock,
  Globe, Lock, BarChart2, ChevronRight, ClipboardList, CheckCircle2,
  TrendingUp, ExternalLink, User, Sparkles,
} from 'lucide-react'
import { isFuture, differenceInSeconds } from 'date-fns'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { formatNumber, timeAgo, formatDateLocal } from '../lib/localeUtils'

function parseUTC(d: string): Date {
  return new Date(d.endsWith('Z') || d.includes('+') ? d : d + 'Z')
}

// ── Live countdown ────────────────────────────────────────────────────────────
function ScheduleCountdown({ targetDate }: { targetDate: Date }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const secs = Math.max(0, differenceInSeconds(targetDate, now))
  if (secs === 0) return <span>{t('dashboard.now', 'now')}</span>
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const parts: string[] = []
  if (d > 0) parts.push(`${formatNumber(d, i18n.language)}d`)
  if (h > 0) parts.push(`${formatNumber(h, i18n.language)}h`)
  if (m > 0) parts.push(`${formatNumber(m, i18n.language)}m`)
  parts.push(`${formatNumber(s, i18n.language)}s`)
  return <span className="font-mono tabular-nums">{parts.join(' ')} {t('dashboard.remaining', 'remaining')}</span>
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className={`inline-flex p-2 rounded-xl mb-3 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {typeof value === 'number' ? formatNumber(value, i18n.language) : value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Quick link ────────────────────────────────────────────────────────────────
function QuickLink({ to, icon: Icon, label, desc, color }: {
  to: string; icon: React.ElementType; label: string; desc: string; color: string
}) {
  return (
    <Link to={to} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:border-primary-200 transition-all flex items-center gap-4 group">
      <div className={`p-3 rounded-xl transition-colors ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">{label}</p>
        <p className="text-sm text-gray-400">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-400 transition-colors shrink-0" />
    </Link>
  )
}

// ── Admin dashboard ───────────────────────────────────────────────────────────
function AdminDashboard({ stats, upcoming, myForms }: {
  stats: EnhancedDashboardAnalytics | null
  upcoming: UpcomingFormOut[]
  myForms: FormOut[]
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const firstName = user?.full_name ? user.full_name.split(' ')[0] : null

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {firstName
            ? t('dashboard.welcomeWithName', { name: firstName, defaultValue: 'Welcome back, {{name}} 👋' })
            : t('dashboard.welcome', 'Welcome back 👋')}
        </h1>
        <p className="text-gray-400 text-sm mt-1">{t('dashboard.subtitle_super', "Here's your platform overview.")}</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label={t('dashboard.totalForms', 'Total Forms')} value={stats.total_forms} icon={FileText} color="bg-blue-100 text-blue-700" sub={`${formatNumber(stats.published_forms, i18n.language)} ${t('dashboard.published', 'published')}`} />
          <StatCard label={t('dashboard.totalUsers', 'Total Users')} value={stats.total_users} icon={Users} color="bg-purple-100 text-purple-700" />
          <StatCard label={t('dashboard.totalSubmissions', 'Total Submissions')} value={stats.total_submissions} icon={Send} color="bg-emerald-100 text-emerald-700" />
          <StatCard label={t('dashboard.publicPrivate', 'Public / Private')} value={`${formatNumber(stats.public_forms, i18n.language)} / ${formatNumber(stats.private_forms, i18n.language)}`} icon={Globe} color="bg-amber-100 text-amber-700" />
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">{t('dashboard.quickActions', 'Quick Actions')}</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <QuickLink to="/forms" icon={FileText} label={t('dashboard.myForms', 'My Forms')} desc={t('dashboard.myForms_desc', 'Create & manage forms')} color="bg-blue-100 text-blue-700 group-hover:bg-blue-200" />
          <QuickLink to="/analytics" icon={BarChart2} label={t('dashboard.analytics', 'Analytics')} desc={t('dashboard.analytics_desc', 'Submission insights')} color="bg-purple-100 text-purple-700 group-hover:bg-purple-200" />
          <QuickLink to="/admin" icon={Shield} label={t('dashboard.adminPanel', 'Admin Panel')} desc={t('dashboard.adminPanel_desc', 'Users, forms & audit log')} color="bg-red-100 text-red-700 group-hover:bg-red-200" />
        </div>
      </div>

      {upcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-semibold text-gray-800">{t('dashboard.upcomingForms', 'Upcoming Forms')}</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{formatNumber(upcoming.length, i18n.language)}</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {upcoming.slice(0, 4).map(f => (
              <div key={f.id} className="bg-white rounded-2xl border border-amber-200 p-4 flex items-start gap-3">
                <div className="bg-amber-100 p-2 rounded-xl shrink-0"><CalendarClock className="w-4 h-4 text-amber-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">{f.title}</p>
                  {f.description && <p className="text-xs text-gray-400 truncate">{f.description}</p>}
                  <p className="text-xs text-amber-600 mt-1 font-medium">
                    {f.starts_at && isFuture(parseUTC(f.starts_at))
                      ? <>{t('dashboard.opens_in', 'Opens in')} <ScheduleCountdown targetDate={parseUTC(f.starts_at)} /></>
                      : t('dashboard.opens_soon', 'Opens soon')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {myForms.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">{t('dashboard.recentForms', 'Recent Forms')}</h2>
            <Link to="/forms" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              {t('dashboard.viewAll', 'View all')} <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {myForms.map(f => (
              <Link key={f.id} to={`/forms/${f.id}/builder`} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className={`w-2 h-2 rounded-full shrink-0 ${f.status === 'published' ? 'bg-emerald-400' : f.status === 'archived' ? 'bg-gray-300' : 'bg-amber-400'}`} />
                <p className="flex-1 text-sm font-medium text-gray-800 truncate">{f.title}</p>
                <span className="text-xs text-gray-400 shrink-0 capitalize">{f.status}</span>
                <span className="text-xs text-gray-300 shrink-0">{timeAgo(parseUTC(f.updated_at), i18n.language)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── User dashboard ────────────────────────────────────────────────────────────
function UserDashboard({ upcoming, recentSubmissions }: {
  upcoming: UpcomingFormOut[]
  recentSubmissions: UserSubmissionOut[]
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.full_name ? user.full_name.split(' ')[0] : null
  const uniqueForms = new Set(recentSubmissions.map(s => s.form_id)).size

  return (
    <div className="p-8 space-y-8">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-primary-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {firstName
                ? t('dashboard.welcomeWithName', { name: firstName, defaultValue: 'Welcome back, {{name}} 👋' })
                : t('dashboard.welcome', 'Welcome back 👋')}
            </h1>
            <p className="text-primary-200 text-sm mt-1">
              {t('dashboard.subtitle_user', 'Discover forms, fill them, and track your responses.')}
            </p>
          </div>
          <button
            onClick={() => navigate('/browse')}
            className="flex items-center gap-2 bg-white text-primary-700 hover:bg-primary-50 font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors shrink-0"
          >
            <Search className="w-4 h-4" />
            {t('dashboard.browseForms', 'Browse Forms')}
          </button>
        </div>
      </div>

      {/* User stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard
          label={t('dashboard.formsFilled', 'Forms Filled')}
          value={recentSubmissions.length}
          icon={ClipboardList}
          color="bg-primary-100 text-primary-700"
          sub={recentSubmissions.length > 0 ? `${formatNumber(uniqueForms, i18n.language)} ${t('dashboard.uniqueForms', 'unique forms')}` : undefined}
        />
        <StatCard
          label={t('dashboard.upcomingForms', 'Upcoming Forms')}
          value={upcoming.length}
          icon={CalendarClock}
          color="bg-amber-100 text-amber-700"
          sub={upcoming.length > 0 ? t('dashboard.openingSoon', 'opening soon') : t('dashboard.noneScheduled', 'none scheduled')}
        />
        <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="inline-flex p-2 rounded-xl mb-3 bg-emerald-100 text-emerald-700">
            <TrendingUp className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {recentSubmissions.length > 0
              ? timeAgo(parseUTC(recentSubmissions[0].submitted_at), i18n.language)
              : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.lastActivity', 'Last Activity')}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">{t('dashboard.quickActions', 'Quick Actions')}</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <QuickLink
            to="/browse"
            icon={Search}
            label={t('dashboard.browseForms', 'Browse Forms')}
            desc={t('dashboard.browseForms_desc', 'Find and fill public forms')}
            color="bg-blue-100 text-blue-700 group-hover:bg-blue-200"
          />
          <QuickLink
            to="/my-forms"
            icon={ClipboardList}
            label={t('dashboard.mySubmissions', 'My Submissions')}
            desc={t('dashboard.mySubmissions_desc', 'View all forms you have filled')}
            color="bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200"
          />
        </div>
      </div>

      {/* Upcoming forms section */}
      {upcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-semibold text-gray-800">
              {t('dashboard.comingSoon', 'Coming Soon')}
            </h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {formatNumber(upcoming.length, i18n.language)}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {upcoming.slice(0, 4).map(f => (
              <div key={f.id} className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-4 flex items-start gap-3">
                <div className="bg-amber-100 p-2 rounded-xl shrink-0">
                  <CalendarClock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate text-sm">{f.title}</p>
                    <span className="text-xs flex items-center gap-0.5 text-gray-400 shrink-0">
                      {f.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    </span>
                  </div>
                  {f.description && (
                    <p className="text-xs text-gray-500 truncate mb-1">{f.description}</p>
                  )}
                  <p className="text-xs text-amber-600 mt-1 font-medium">
                    {f.starts_at && isFuture(parseUTC(f.starts_at))
                      ? <>{t('dashboard.opens_in', 'Opens in')} <ScheduleCountdown targetDate={parseUTC(f.starts_at)} /></>
                      : t('dashboard.opens_soon', 'Opens soon')}
                    {f.starts_at && ` · ${formatDateLocal(parseUTC(f.starts_at), i18n.language, { dateStyle: 'medium' })}`}
                  </p>
                </div>
                <span className="text-xs bg-amber-50 text-amber-500 border border-amber-200 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                  {t('dashboard.previewOnly', 'Preview only')}
                </span>
              </div>
            ))}
          </div>
          {upcoming.length > 4 && (
            <Link to="/browse" className="text-sm text-primary-600 hover:underline mt-2 inline-block">
              {t('dashboard.view_all_upcoming_forms', 'View all {{count}} upcoming forms →', { count: upcoming.length })}
            </Link>
          )}
        </div>
      )}

      {/* Recent submissions */}
      {recentSubmissions.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary-500" />
              <h2 className="text-base font-semibold text-gray-800">
                {t('dashboard.recentlyFilled', 'Recently Filled')}
              </h2>
            </div>
            <Link to="/my-forms" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              {t('dashboard.viewAll', 'View all')} <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {recentSubmissions.slice(0, 5).map(sub => (
              <div key={sub.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {sub.form_title ?? t('dashboard.deletedForm', 'Deleted Form')}
                  </p>
                  {sub.owner_name && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <User className="w-3 h-3" /> {sub.owner_name}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{timeAgo(parseUTC(sub.submitted_at), i18n.language)}</p>
                  <p className="text-xs text-gray-300 mt-0.5">
                    {formatNumber(sub.answer_count, i18n.language)} {t('dashboard.answers', 'answers')}
                  </p>
                </div>
                {sub.form_uuid && (
                  <button
                    onClick={() => navigate(`/public/${sub.form_uuid}`)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-primary-500 transition-colors shrink-0"
                    title={t('dashboard.fillAgain', 'Fill again')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Empty state — no submissions yet */
        <div className="bg-gradient-to-r from-primary-50 via-blue-50 to-indigo-50 rounded-2xl border border-primary-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-primary-900">{t('dashboard.gettingStarted', 'Get Started')}</h2>
          </div>
          <p className="text-sm text-primary-700 mb-4">
            {t('dashboard.gettingStartedHint', "You haven't filled any forms yet. Browse the available forms and submit your first response!")}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link
              to="/browse"
              className="bg-white/80 hover:bg-white rounded-xl p-4 transition-colors group flex items-start gap-3"
            >
              <Search className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-primary-900 text-sm">{t('dashboard.browseForms', 'Browse Forms')}</p>
                <p className="text-xs text-primary-600 mt-0.5">{t('dashboard.browseForms_desc', 'Find and fill public forms')}</p>
              </div>
            </Link>
            <Link
              to="/my-forms"
              className="bg-white/80 hover:bg-white rounded-xl p-4 transition-colors group flex items-start gap-3"
            >
              <ClipboardList className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-primary-900 text-sm">{t('dashboard.mySubmissions', 'My Submissions')}</p>
                <p className="text-xs text-primary-600 mt-0.5">{t('dashboard.mySubmissions_desc', 'Track your filled forms')}</p>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main dashboard page ───────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<EnhancedDashboardAnalytics | null>(null)
  const [upcoming, setUpcoming] = useState<UpcomingFormOut[]>([])
  const [myForms, setMyForms] = useState<FormOut[]>([])
  const [recentSubmissions, setRecentSubmissions] = useState<UserSubmissionOut[]>([])

  useEffect(() => {
    if (!user) return

    if (user.is_superuser) {
      analyticsApi.enhancedDashboard().then(setStats).catch(() => {})
      formsApi.list(0, 8).then(setMyForms).catch(() => {})
    } else {
      profileApi.mySubmissions(0, 20).then(setRecentSubmissions).catch(() => {})
    }

    schedulesApi.upcoming().then(setUpcoming).catch(() => {})
  }, [user])

  if (!user) return null

  return user.is_superuser
    ? <AdminDashboard stats={stats} upcoming={upcoming} myForms={myForms} />
    : <UserDashboard upcoming={upcoming} recentSubmissions={recentSubmissions} />
}
