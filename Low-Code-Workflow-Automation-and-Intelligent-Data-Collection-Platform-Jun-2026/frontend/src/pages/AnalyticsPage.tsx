import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { analyticsApi, formsApi } from '../lib/apiModules'
import type {
  FormAnalytics, SubmissionAnalytics, TrendsAnalytics,
  FormOut, EnhancedDashboardAnalytics,
} from '../lib/types'
import {
  ChevronLeft, TrendingUp, Send, Star, FileText, Users,
  BarChart2, Globe, Trophy, Layers,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { formatNumber } from '../lib/localeUtils'
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16']

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className={`inline-flex p-2 rounded-xl mb-3 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? formatNumber(value, i18n.language) : value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────
export function AnalyticsDashboard() {
  const { t } = useTranslation()
  const [forms,    setForms]    = useState<FormOut[]>([])
  const [trends,   setTrends]   = useState<TrendsAnalytics | null>(null)
  const [enhanced, setEnhanced] = useState<EnhancedDashboardAnalytics | null>(null)
  const [range, setRange] = useState<'24h'|'7d'|'30d'|'1y'>('30d')
  const [chartHeight, setChartHeight] = useState<number>(200)
  const [chartData, setChartData] = useState<Array<{label:string,count:number}>>([])
  const navigate = useNavigate()

  useEffect(() => {
    formsApi.list().then(setForms).catch(() => {})
    analyticsApi.trends().then(setTrends).catch(() => {})
    analyticsApi.enhancedDashboard().then((data) => { setEnhanced(data); if (data) setChartData(data.submissions_last_30_days) }).catch(() => {})
  }, [])

  useEffect(() => {
    // Responsive chart height based on viewport width
    const computeHeight = () => {
      const w = window.innerWidth
      if (w < 640) return 160
      if (w < 1024) return 220
      return 300
    }
    const onResize = () => setChartHeight(computeHeight())
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    // Update chartData based on selected range using available enhanced data
    if (!enhanced || !enhanced.submissions_last_30_days) return
    const src = enhanced.submissions_last_30_days || []
    if (range === '30d') setChartData(src)
    else if (range === '7d') setChartData(src.slice(Math.max(0, src.length - 7)))
    else if (range === '24h') {
      // No hourly data available from backend — fall back to last 7 days and notify
      setChartData(src.slice(Math.max(0, src.length - 1)))
    } else if (range === '1y') {
      // No yearly rollup available; fall back to available 30-day data
      setChartData(src)
    }
  }, [range, enhanced])

  const handleRangeChange = (r: '24h'|'7d'|'30d'|'1y') => {
    setRange(r)
    if (!enhanced) return
    if (r === '24h') {
      // notify user we don't have hourly data
      import('react-hot-toast').then(({ default: toast }) => toast('Hourly data not available — showing last available day'))
    }
    if (r === '1y') {
      import('react-hot-toast').then(({ default: toast }) => toast('Yearly rollup not available — showing last 30 days'))
    }
  }

  const formStatusData = enhanced ? [
    { name: t('status.published','Published'), value: enhanced.published_forms, fill: '#10b981' },
    { name: t('status.draft','Draft'),     value: enhanced.draft_forms,     fill: '#f59e0b' },
    { name: t('status.archived','Archived'),  value: enhanced.archived_forms,  fill: '#94a3b8' },
  ].filter(d => d.value > 0) : []
 
  const visibilityData = enhanced ? [
    { name: t('forms.public','Public'),  value: enhanced.public_forms,  fill: '#3b82f6' },
    { name: t('forms.private','Private'), value: enhanced.private_forms, fill: '#8b5cf6' },
  ].filter(d => d.value > 0) : []

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('analytics.title','Analytics')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('analytics.subtitle','Platform-wide insights')}</p>
      </div>

      {/* KPI Row */}
      {enhanced && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label={t('analytics.total_forms','Total Forms')}       value={enhanced.total_forms}       icon={FileText}   color="bg-blue-100 text-blue-700" />
          <StatCard label={t('analytics.total_users','Total Users')}       value={enhanced.total_users}       icon={Users}      color="bg-purple-100 text-purple-700" />
          <StatCard label={t('analytics.total_submissions','Total Submissions')} value={enhanced.total_submissions} icon={Send}       color="bg-emerald-100 text-emerald-700" />
          <StatCard label={t('analytics.published_forms','Published Forms')}   value={enhanced.published_forms}   icon={Globe}      color="bg-amber-100 text-amber-700"
            sub={`${formatNumber(enhanced.draft_forms, i18n.language)} ${t('analytics.drafts','drafts')} · ${formatNumber(enhanced.archived_forms, i18n.language)} ${t('analytics.archived','archived')}`} />
        </div>
      )}

      {/* Charts row 1 */}
      {enhanced && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* 30-day area chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h3 className="font-semibold text-gray-700">{t('analytics.submissions_last_30_days','Submissions')}</h3>
            <div className="flex items-center gap-2">
              { (['24h','7d','30d','1y'] as Array<'24h'|'7d'|'30d'|'1y'>).map(r => (
                <button key={r} onClick={() => handleRangeChange(r)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition ${range === r ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                  {r === '24h' ? t('analytics.last_24_hours','24h') : r === '7d' ? t('analytics.last_7_days','7d') : r === '30d' ? t('analytics.last_30_days','30d') : t('analytics.last_year','1y')}
                </button>
              ))}
            </div>
          </div>

            <ResponsiveContainer width="100%" height={chartHeight}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 8))} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Form status pie */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-4">{t('analytics.form_status','Form Status')}</h3>
            {formStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={formStatusData} dataKey="value" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${formatNumber(value, i18n.language)}`} labelLine={false}>
                    {formStatusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-300 text-sm">{t('analytics.no_data_yet','No data yet')}</div>
            )}
          </div>
        </div>
      )}

      {/* Charts row 2 */}
      {enhanced && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Field type breakdown */}
          {enhanced.field_type_breakdown.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-gray-400" /> {t('analytics.field_type_usage','Field Type Usage')}
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={enhanced.field_type_breakdown.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="field_type" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0,6,6,0]}>
                    {enhanced.field_type_breakdown.slice(0,8).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Visibility pie */}
          {visibilityData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-400" /> {t('analytics.public_vs_private','Public vs Private')}
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={visibilityData} dataKey="value" cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85} paddingAngle={4}
                    label={({ name, value }) => `${name}: ${formatNumber(value, i18n.language)}`}>
                    {visibilityData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Trends */}
      {trends && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-400" /> {t('analytics.platform_trends','Platform Trends')}
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">{t('analytics.busiest_day','Busiest Day')}</p>
              <p className="text-2xl font-bold text-blue-800">{trends.trending_day}</p>
              <p className="text-xs text-blue-500 mt-1">{t('analytics.most_submissions_weekday','Most submissions on this weekday')}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wide mb-1">{t('analytics.top_form','Top Form')}</p>
              <p className="text-lg font-bold text-emerald-800 truncate">{trends.most_submitted_form?.name ?? '—'}</p>
              {trends.most_submitted_form && <p className="text-xs text-emerald-500 mt-1">{formatNumber(trends.most_submitted_form.count, i18n.language)} {t('analytics.submissions','submissions')}</p>}
            </div>
            <div className="bg-violet-50 rounded-xl p-4">
              <p className="text-xs text-violet-500 font-semibold uppercase tracking-wide mb-1">{t('analytics.most_used_field','Most Used Field')}</p>
              <p className="text-lg font-bold text-violet-800 truncate">{trends.most_used_field?.name ?? '—'}</p>
              {trends.most_used_field && <p className="text-xs text-violet-500 mt-1">{formatNumber(trends.most_used_field.count, i18n.language)} {t('analytics.answers','answers')}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Top forms leaderboard */}
      {enhanced && enhanced.top_forms.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> {t('analytics.top_forms_by_submissions','Top Forms by Submissions')}
          </h3>
          <div className="space-y-2">
            {enhanced.top_forms.map((f, i) => (
              <div key={f.form_id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-amber-100 text-amber-700' :
                  i === 1 ? 'bg-gray-100 text-gray-600' :
                  i === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-gray-50 text-gray-400'
                }`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{f.title}</p>
                  <p className="text-xs text-gray-400 capitalize">{t(`status.${f.status}`, f.status)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{formatNumber(f.submission_count, i18n.language)}</p>
                  <p className="text-xs text-gray-400">{t('analytics.submissions','submissions')}</p>
                </div>
                <div className="w-24 bg-gray-100 rounded-full h-1.5 shrink-0">
                  <div className="h-1.5 rounded-full bg-primary-500 transition-all"
                    style={{ width: `${enhanced.top_forms[0].submission_count > 0 ? (f.submission_count / enhanced.top_forms[0].submission_count) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-form drill-down selector */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">{t('analytics.per_form_analytics','Per-Form Analytics')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map(f => (
            <button key={f.id} onClick={() => navigate(`/analytics/${f.id}`)}
              className="bg-white rounded-2xl border border-gray-200 p-4 text-left hover:border-primary-300 hover:shadow-sm transition-all flex items-center gap-3">
              <div className="bg-primary-50 p-2 rounded-xl shrink-0">
                <BarChart2 className="w-4 h-4 text-primary-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate text-sm">{f.title}</p>
                <p className="text-xs text-gray-400 capitalize">{t(`status.${f.status}`, f.status)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Per-form page ──────────────────────────────────────────────────────────
export default function FormAnalyticsPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const formId = Number(id)
  const [fa, setFa] = useState<FormAnalytics | null>(null)
  const [sa, setSa] = useState<SubmissionAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([analyticsApi.form(formId), analyticsApi.submission(formId)])
      .then(([f, s]) => { setFa(f); setSa(s) })
      .finally(() => setLoading(false))
  }, [formId])

  if (loading)
  return <div className="flex items-center justify-center h-64 text-gray-400">{t('analytics.loading','Loading…')}</div>
  if (!fa || !sa)
  return null

  const fieldData = Object.entries(
    fa.field_statistics.reduce<Record<string, number>>((acc, s) => {
      acc[s.field_name] = (acc[s.field_name] || 0) + s.count; return acc
    }, {})
  ).map(([name, count]) => ({ name, count }))
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/analytics" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{fa.title}</h1>
          <p className="text-sm text-gray-400">{t('analytics.form_analytics','Form analytics')}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label={t('analytics.total_submissions','Total Submissions')} value={sa.total_submissions} icon={Send}        color="bg-blue-100 text-blue-700" />
        <StatCard label={t('analytics.today','Today')}             value={sa.today}             icon={TrendingUp}  color="bg-emerald-100 text-emerald-700" />
        <StatCard label={t('analytics.this_week','This Week')}         value={sa.this_week}         icon={TrendingUp}  color="bg-violet-100 text-violet-700" />
        <StatCard label={t('analytics.avg_rating','Avg Rating')}        value={fa.average_rating != null ? t('analytics.avg_rating_value','{{value}} ★', { value: formatNumber(Number(fa.average_rating.toFixed(1)), i18n.language) }) : '—'} icon={Star} color="bg-amber-100 text-amber-700" />
      </div>

      {/* Time charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">{t('analytics.daily_last_7_days','Daily (last 7 days)')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={sa.daily_submissions}>
              <defs>
                <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#dg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">{t('analytics.monthly_last_6_months','Monthly (last 6 months)')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sa.monthly_submissions}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Field + rating */}
      <div className="grid lg:grid-cols-2 gap-6">
        {fieldData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-4">{t('analytics.answers_per_field','Answers per Field')}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={fieldData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {fa.rating_statistics.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-4">{t('analytics.rating_distribution','Rating Distribution')}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={fa.rating_statistics} dataKey="count" nameKey="rating"
                  cx="50%" cy="50%" outerRadius={80}
                  label={({ name, value }) => `★${name}: ${value}`}>
                  {fa.rating_statistics.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
