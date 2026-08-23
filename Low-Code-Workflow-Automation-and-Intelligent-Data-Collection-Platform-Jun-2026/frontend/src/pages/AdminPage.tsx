import { useEffect, useState } from 'react'
import { adminApi, formsApi } from '../lib/apiModules'
import type { FormSubmissionOut, FormOut, AdminUserOut, AdminFormOut, AuditLogEntry } from '../lib/types'
import toast from 'react-hot-toast'
import axios from 'axios'
import {
  Shield, Trash2, ChevronDown, ChevronUp, Users, FileText,
  Activity, Search, UserCheck, UserX, Crown, Globe, Lock,
  Languages, Loader2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { formatDateLocal, timeAgo, formatNumber } from '../lib/localeUtils'
function parseUTC(d: string): Date {
  return new Date(d.endsWith('Z') || d.includes('+') ? d : d + 'Z')
}

// ── Translate text to any language via MyMemory (free, no key needed) ─────────
async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text?.trim())
  return text
  if (targetLang === 'en')
  return text  // no-op
  try {
    // Use 'en' as source — MyMemory handles detection much better with explicit source
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|${targetLang}&de=admin@platform.com`
const res = await axios.get(url, { timeout: 8000 })
  const translated = res.data?.responseData?.translatedText
    const responseStatus = String(res.data?.responseStatus)
    if (translated && responseStatus === '200')
  return translated
    // If en|target fails, try auto|target
    const url2 = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=auto|${targetLang}`
const res2 = await axios.get(url2, { timeout: 8000 })
  const translated2 = res2.data?.responseData?.translatedText
    if (translated2 && String(res2.data?.responseStatus) === '200')
  return translated2
  } catch { /* ignore */ }
  return text
}

const TRANSLATE_LANGUAGES: Record<string, string> = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', mr: 'Marathi',
  bn: 'Bengali', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
  ar: 'Arabic', ur: 'Urdu', fr: 'French', de: 'German', es: 'Spanish',
  pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', ru: 'Russian',
}

type Tab = 'submissions' | 'users' | 'forms' | 'audit'

// ── Submission detail with inline translation ─────────────────────────────────
function SubmissionDetail({ sub, fieldMap, formTitle }: {
  sub: FormSubmissionOut
  fieldMap: Record<number, string>
  formTitle?: string
}) {
  const { t } = useTranslation()
  const [translating, setTranslating]   = useState(false)
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [showTranslated, setShowTranslated] = useState(false)
  const [targetLang, setTargetLang]     = useState('en')
  const handleTranslate = async () => {
    setTranslating(true)
  const result: Record<string, string> = {}

    // Translate all answer values + field labels
    await Promise.all([
      // Translate each answer value
      ...sub.answers.map(async ans => {
        const raw = ans.answer_value ?? (ans.answer_json != null ? JSON.stringify(ans.answer_json) : '')
        if (raw) result[`ans_${ans.id}`] = await translateText(raw, targetLang)
      }),
      // Translate each field label
      ...sub.answers.map(async ans => {
        const label = fieldMap[ans.form_field_id ?? -1]
        if (label) result[`label_${ans.form_field_id}`] = await translateText(label, targetLang)
      }),
      // Translate form title if present
      ...(formTitle ? [translateText(formTitle, targetLang).then(t => { result['form_title'] = t })] : []),
    ])

    setTranslations(result)
    setShowTranslated(true)
    setTranslating(false)
    toast.success(t('admin.translated_to','Translated to {{lang}}', { lang: TRANSLATE_LANGUAGES[targetLang] }))
  }

  return (
    <div className="border-t border-gray-100 px-5 py-4">
      {formTitle && showTranslated && translations['form_title'] && (
        <div className="mb-3 px-3 py-2 bg-blue-50 rounded-xl text-xs text-blue-700">
          <span className="font-semibold">{t('admin.form','Form')}:</span> {translations['form_title']}
          <span className="text-blue-400 ml-2">({t('admin.original','Original:')} {formTitle})</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs text-gray-400">{t('admin.answers_count','{{formattedCount}} answer{{plural}}', { count: sub.answers.length, formattedCount: formatNumber(sub.answers.length, i18n.language), plural: sub.answers.length !== 1 ? 's' : '' })}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {showTranslated && (
            <button onClick={() => setShowTranslated(false)} className="text-xs text-gray-500 hover:text-gray-700 underline">
              {t('admin.show_original','Show original')}
            </button>
          )}
          <select value={targetLang} onChange={e => { setTargetLang(e.target.value); setShowTranslated(false); setTranslations({}) }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
            {Object.entries(TRANSLATE_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          <button onClick={showTranslated ? () => setShowTranslated(false) : handleTranslate} disabled={translating}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            {translating
              ? <><Loader2 className="w-3 h-3 animate-spin" /> {t('admin.translating','Translating…')}</>
              : <><Languages className="w-3 h-3" /> {showTranslated ? `${TRANSLATE_LANGUAGES[targetLang]} ✓` : t('admin.translate_everything','Translate everything to {{lang}}', { lang: TRANSLATE_LANGUAGES[targetLang] })}</>}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[24rem] text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase">
              <th className="text-left pb-2 font-medium">
                {showTranslated ? `${t('admin.field')} (${TRANSLATE_LANGUAGES[targetLang]})` : t('admin.field')}
              </th>
              <th className="text-left pb-2 font-medium">
                {showTranslated ? `${t('admin.answer')} (${TRANSLATE_LANGUAGES[targetLang]})` : t('admin.answer_original')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
          {sub.answers.map(ans => {
            const original = ans.answer_value ?? (ans.answer_json != null ? JSON.stringify(ans.answer_json) : null)
  const originalLabel = fieldMap[ans.form_field_id ?? -1] ?? t('submissions.field_number', { id: ans.form_field_id })
const displayLabel  = showTranslated ? (translations[`label_${ans.form_field_id}`] ?? originalLabel) : originalLabel
            const displayAnswer = showTranslated ? (translations[`ans_${ans.id}`] ?? original) : original
            return (
              <tr key={ans.id}>
                <td className="py-2 pr-4 font-medium text-gray-700 w-1/3">
                  {displayLabel}
                  {showTranslated && translations[`label_${ans.form_field_id}`] && translations[`label_${ans.form_field_id}`] !== originalLabel && (
                    <p className="text-xs text-gray-400 font-normal">{originalLabel}</p>
                  )}
                </td>
                <td className="py-2 text-gray-600">
                  {displayAnswer ?? <span className="italic text-gray-300">—</span>}
                  {showTranslated && original && translations[`ans_${ans.id}`] && translations[`ans_${ans.id}`] !== original && (
                    <p className="text-xs text-gray-400 mt-0.5">{t('admin.original','Original:')} {original}</p>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
        {t('admin.translate_note','Translates field labels, answers, and form title — select language and click Translate.')}
      </p>
    </div>
  )
}

export default function AdminPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('submissions')

  // Submissions
  const [allForms,     setAllForms]     = useState<FormOut[]>([])
  const [selectedForm, setSelectedForm] = useState<number | ''>('')
  const [submissions,  setSubmissions]  = useState<FormSubmissionOut[]>([])
  const [expanded,     setExpanded]     = useState<number | null>(null)

  // Users
  const [users,       setUsers]       = useState<AdminUserOut[]>([])
  const [userSearch,  setUserSearch]  = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Admin forms
  const [adminForms,    setAdminForms]    = useState<AdminFormOut[]>([])
  const [formSearch,    setFormSearch]    = useState('')
  const [formStatus,    setFormStatus]    = useState('')
  const [loadingForms,  setLoadingForms]  = useState(false)

  // Audit
  const [auditLogs,    setAuditLogs]    = useState<AuditLogEntry[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [auditSearch,  setAuditSearch]  = useState('')
  const [auditResource, setAuditResource] = useState('')

  const auditResources = Array.from(new Set(auditLogs.map(log => log.resource_type).filter(Boolean) as string[]))

  const auditActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'form.created': t('admin.action.form_created','Form created'),
      'form.updated': t('admin.action.form_updated','Form updated'),
      'form.deleted': t('admin.action.form_deleted','Form deleted'),
      'form.published': t('admin.action.form_published','Form published'),
      'form.version_created': t('admin.action.form_version_created','Form version created'),
      'form.public_submitted': t('admin.action.public_form_submitted','Public form submitted'),
      'user.created': t('admin.action.user_created','User created'),
      'user.deleted': t('admin.action.user_deleted','User deleted'),
      'user.updated': t('admin.action.user_updated','User updated'),
      'submission.created': t('admin.action.submission_created','Submission created'),
    }
    return labels[action] ?? t(`admin.action.${action}`, action)
  }

  const formatAuditDetailKey = (key: string) =>
    t(`admin.audit_detail_key.${key}`, key.replace(/_/g, ' '))

  const formatAuditValue = (value: unknown) => {
    if (value == null) return t('admin.none','None')
    if (typeof value === 'number') return formatNumber(value, i18n.language)
    if (typeof value === 'string') return value
    return JSON.stringify(value)
  }

  const formatAuditDetails = (details: unknown): React.ReactNode => {
    if (!details) return null

    if (Array.isArray(details)) {
      return details.map((value, index) => (
        <span key={index} className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
          {formatAuditValue(value)}
        </span>
      ))
    }

    if (typeof details === 'object') {
      return Object.entries(details).map(([key, value]) => (
        <span key={key} className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
          {t('admin.audit_detail_pair','{{key}}: {{value}}', { key: formatAuditDetailKey(key), value: formatAuditValue(value) })}
        </span>
      ))
    }

    return <span className="text-xs text-gray-500">{String(details)}</span>
  }

  const filteredAuditLogs = auditLogs.filter(log => {
    const query = auditSearch.trim().toLowerCase()
    if (query) {
      const haystack = [
        auditActionLabel(log.action),
        log.action,
        log.resource_type ?? '',
        log.resource_id != null ? String(log.resource_id) : '',
        log.user_id != null ? String(log.user_id) : '',
        log.ip_address ?? '',
        typeof log.details === 'string' ? log.details : JSON.stringify(log.details ?? ''),
      ].join(' ').toLowerCase()
      if (!haystack.includes(query)) return false
    }
    if (auditResource && log.resource_type !== auditResource) return false
    return true
  })

  const auditCountLabel = (count: number) =>
    t('admin.audit_log_count','{{formattedCount}} audit event{{plural}}',{ count, formattedCount: formatNumber(count, i18n.language), plural: count !== 1 ? 's' : '' })

  // Init
  useEffect(() => { formsApi.list(0, 100).then(setAllForms).catch(() => {}) }, [])

  useEffect(() => {
    if (tab === 'users')   loadUsers()
    if (tab === 'forms')   loadAdminForms()
    if (tab === 'audit')   loadAudit()
  }, [tab])

  useEffect(() => {
    if (!selectedForm) return
    if (selectedForm === -1) {
      // Load orphaned (deleted form) submissions via dedicated endpoint
      adminApi.orphanedSubmissions({ limit: 200 })
        .then(setSubmissions)
        .catch(() => toast.error(t('admin.error_load_orphaned_submissions','Failed to load orphaned submissions')))
    } else {
      formsApi.submissions(Number(selectedForm))
        .then(setSubmissions)
          .catch(() => toast.error(t('admin.error_load_submissions','Failed to load submissions')))
    }
  }, [selectedForm])
  const loadUsers = async () => {
    setLoadingUsers(true)
    try { setUsers(await adminApi.listUsers()) }
    catch { toast.error(t('admin.error_load_users','Failed to load users')) }
    finally { setLoadingUsers(false) }
  }
 
  const loadAdminForms = async () => {
    setLoadingForms(true)
    try { setAdminForms(await adminApi.listAllForms()) }
    catch { toast.error(t('admin.error_load_forms','Failed to load forms')) }
    finally { setLoadingForms(false) }
  }
 
  const loadAudit = async () => {
    setLoadingAudit(true)
    try { setAuditLogs(await adminApi.auditLogs({ limit: 100 })) }
    catch { toast.error(t('admin.error_load_audit','Failed to load audit logs')) }
    finally { setLoadingAudit(false) }
  }
 
  const handleToggleActive = async (id: number) => {
    try { const u = await adminApi.toggleUserActive(id); setUsers(prev => prev.map(x => x.id === id ? u : x)); toast.success(t('admin.updated','Updated')) }
    catch { toast.error(t('admin.failed','Failed')) }
  }
 
  const handleToggleSuperuser = async (id: number) => {
    try { const u = await adminApi.toggleSuperuser(id); setUsers(prev => prev.map(x => x.id === id ? u : x)); toast.success(t('admin.updated','Updated')) }
    catch { toast.error(t('admin.failed','Failed')) }
  }
 
  const handleDeleteUser = async (id: number, email: string) => {
    if (!confirm(t('admin.confirm_delete_user','Delete user "{{email}}"? This cannot be undone.', { email }))) return
    try { await adminApi.deleteUser(id); setUsers(prev => prev.filter(u => u.id !== id)); toast.success(t('admin.user_deleted','User deleted')) }
    catch { toast.error(t('admin.error_delete_user','Failed to delete user')) }
  }
 
  const handleDeleteForm = async (id: number) => {
    if (!confirm(t('admin.confirm_delete_form','Delete this form and all its data?'))) return
    try { await adminApi.deleteForm(id); setAdminForms(prev => prev.filter(f => f.id !== id)); toast.success(t('admin.form_deleted','Form deleted')) }
    catch { toast.error(t('admin.error_delete_form','Failed to delete form')) }
  }

  const fieldMap = allForms
    .flatMap(f => f.versions.flatMap(v => v.fields))
    .reduce<Record<number, string>>((acc, f) => ({ ...acc, [f.id]: f.label }), {})

  // Map form_id → form title for deleted-form submissions
  const formTitleMap = allForms.reduce<Record<number, string>>((acc, f) => ({ ...acc, [f.id]: f.title }), {})
  const filteredUsers = users.filter(u =>
    !userSearch || u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.full_name ?? '').toLowerCase().includes(userSearch.toLowerCase())
  )
  const filteredAdminForms = adminForms.filter(f => {
    const matchSearch = !formSearch || f.title.toLowerCase().includes(formSearch.toLowerCase())
  const matchStatus = !formStatus || f.status === formStatus
    return matchSearch && matchStatus
  })
  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'submissions', label: t('admin.tab_submissions','Submissions'), icon: ChevronDown },
    { key: 'users',       label: t('admin.tab_users','Users'),       icon: Users },
    { key: 'forms',       label: t('admin.tab_forms','All Forms'),   icon: FileText },
    { key: 'audit',       label: t('admin.tab_audit','Audit Log'),   icon: Activity },
  ]

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-red-100 p-2.5 rounded-xl">
          <Shield className="w-5 h-5 text-red-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.title','Admin Panel')}</h1>
          <p className="text-sm text-gray-400">{t('admin.subtitle','Superuser — full platform access')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* ── Submissions ──────────────────────────────────────────────── */}
      {tab === 'submissions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-gray-600 shrink-0">{t('admin.select_form_label','Select Form:')}</label>
            <select className="input w-72"
              value={selectedForm}
              onChange={e => setSelectedForm(e.target.value ? Number(e.target.value) : '')}>
              <option value="">{t('admin.choose_form_placeholder','— choose a form —')}</option>
              {allForms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
              <option value="-1">🗑️ {t('admin.deleted_forms_orphaned','Deleted Forms (orphaned responses)')}</option>
            </select>
          </div>
          {!selectedForm && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
              {t('admin.select_form_prompt','Select a form above to view its submissions')}
            </div>
          )}
          {selectedForm && submissions.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
              {t('admin.no_submissions_form','No submissions for this form yet')}
            </div>
          )}
          <div className="space-y-3">
            {submissions.map((sub, idx) => (
              <div key={sub.id} className="bg-white rounded-2xl border overflow-hidden"
                style={{ borderColor: sub.form_id == null ? '#fca5a5' : '#e5e7eb' }}>
                <button className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-gray-400 font-mono">#{formatNumber(idx + 1, i18n.language)}</span>
                    <span className="text-sm font-medium text-gray-800">{formatDateLocal(parseUTC(sub.submitted_at), i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{formatNumber(sub.answers.length, i18n.language)} {t('admin.answers','answers')}</span>
                    {sub.submitted_by_id
                      ? <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{t('admin.user_tag','User #{{id}}', { id: formatNumber(sub.submitted_by_id, i18n.language) })}</span>
                      : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t('admin.anonymous','Anonymous')}</span>}
                    {sub.form_id == null && (
                      <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        🗑️ {t('admin.form_deleted','Form deleted')}
                      </span>
                    )}
                  </div>
                  {expanded === sub.id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>
                {expanded === sub.id && (
                  <SubmissionDetail
                    sub={sub}
                    fieldMap={fieldMap}
                    formTitle={sub.form_id ? formTitleMap[sub.form_id] : undefined}
                  />
                )}
              </div>
            ))}
          </div>

          {/* CSV Export */}
          {submissions.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                 const headers = ['#', t('admin.csv_submitted_at','Submitted At'), t('admin.csv_user','User'), ...Object.values(fieldMap)]
  const rows = submissions.map((sub, idx) => {
                    const ansMap = sub.answers.reduce<Record<number, string>>((a, ans) => {
                      if (ans.form_field_id != null) a[ans.form_field_id] = ans.answer_value ?? ''
return a
                    }, {})
  return [
                      idx + 1,
                      formatDateLocal(parseUTC(sub.submitted_at), i18n.language, { dateStyle: 'medium', timeStyle: 'short' }),
                     sub.submitted_by_id ?? t('admin.anonymous','Anonymous'),
                      ...Object.keys(fieldMap).map(k => ansMap[Number(k)] ?? '')
                    ]
                  })
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = `submissions_${selectedForm}_${Date.now()}.csv`
                  a.click()
                 toast.success(t('admin.csv_downloaded','CSV downloaded'))
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
              >
               ⬇ {t('admin.export_csv','Export CSV')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Users ───────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder={t('admin.search_users_placeholder','Search by name or email…')}
              value={userSearch} onChange={e => setUserSearch(e.target.value)} />
          </div>
          <p className="text-sm text-gray-400">{formatNumber(filteredUsers.length, i18n.language)} {t('admin.users','user')}{filteredUsers.length !== 1 ? t('admin.plural_s','s') : ''}</p>
          {loadingUsers ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl border border-gray-200 h-16 animate-pulse" />)}</div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {filteredUsers.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    u.is_superuser ? 'bg-red-100 text-red-700' : 'bg-primary-100 text-primary-700'
                  }`}>
                    {(u.full_name || u.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.full_name || u.email}</p>
                      {u.is_superuser && <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Crown className="w-2.5 h-2.5"/>{t('admin.admin','Admin')}</span>}
                      {!u.is_active && <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">{t('admin.inactive','Inactive')}</span>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {u.email} · {formatNumber(u.form_count, i18n.language)} {t('admin.forms','form')}{u.form_count !== 1 ? t('admin.plural_s','s') : ''} · {formatNumber(u.submission_count, i18n.language)} {t('admin.submission','submission')}{u.submission_count !== 1 ? t('admin.plural_s','s') : ''}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 shrink-0 hidden sm:block">
                    {t('admin.joined','Joined')} {timeAgo(parseUTC(u.created_at), i18n.language)}
                  </p>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleToggleActive(u.id)} title={u.is_active ? t('admin.deactivate','Deactivate') : t('admin.activate','Activate')}
                      className={`p-1.5 rounded-lg transition-colors ${u.is_active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                      {u.is_active ? <UserCheck className="w-4 h-4"/> : <UserX className="w-4 h-4"/>}
                    </button>
                    <button onClick={() => handleToggleSuperuser(u.id)} title={u.is_superuser ? t('admin.remove_admin','Remove admin') : t('admin.make_admin','Make admin')}
                      className={`p-1.5 rounded-lg transition-colors ${u.is_superuser ? 'text-red-500 hover:bg-red-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                      <Crown className="w-4 h-4"/>
                    </button>
                    <button onClick={() => handleDeleteUser(u.id, u.email)} title={t('admin.delete_user','Delete user')}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-center py-8 text-gray-400">{t('admin.no_users_found','No users found')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── All Forms ───────────────────────────────────────────────── */}
      {tab === 'forms' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" placeholder={t('admin.search_forms_placeholder','Search forms…')} value={formSearch} onChange={e => setFormSearch(e.target.value)} />
            </div>
            <select className="input w-36" value={formStatus} onChange={e => setFormStatus(e.target.value)}>
              <option value="">{t('admin.all_statuses','All statuses')}</option>
              <option value="published">{t('forms.published','Published')}</option>
              <option value="draft">{t('forms.draft','Draft')}</option>
              <option value="archived">{t('forms.archived','Archived')}</option>
            </select>
          </div>
          <p className="text-sm text-gray-400">{formatNumber(filteredAdminForms.length, i18n.language)} {t('admin.forms','form')}{filteredAdminForms.length !== 1 ? t('admin.plural_s','s') : ''}</p>          {loadingForms ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl border border-gray-200 h-16 animate-pulse" />)}</div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {filteredAdminForms.map(f => (
                <div key={f.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 truncate">{f.title}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize border ${
                        f.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        f.status === 'archived'  ? 'bg-gray-100 text-gray-500 border-gray-200' :
                        'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>{t(`forms.${f.status}`, f.status)}</span>
                      <span className="text-xs flex items-center gap-1 text-gray-400">
                        {f.is_public ? <Globe className="w-3 h-3"/> : <Lock className="w-3 h-3"/>}
                        {f.is_public ? t('forms.public','Public') : t('forms.private','Private')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {t('admin.owner','Owner')}: {f.owner_email ?? `#${formatNumber(f.owner_id, i18n.language)}`} · {formatNumber(f.submission_count, i18n.language)} {t('admin.submissions','submissions')}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteForm(f.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    title={t('admin.delete_form','Delete form')}>
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              ))}
              {filteredAdminForms.length === 0 && (
                <p className="text-center py-8 text-gray-400">{t('admin.no_forms_found','No forms found')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Audit Log ───────────────────────────────────────────────── */}
      {tab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">{t('admin.audit_log_title','Audit log')}</p>
              <p className="text-sm text-gray-500">{auditCountLabel(filteredAuditLogs.length)}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input pl-9" placeholder={t('admin.audit_search_placeholder','Search audit events…')} value={auditSearch} onChange={e => setAuditSearch(e.target.value)} />
              </div>
              <select className="input w-full max-w-xs" value={auditResource} onChange={e => setAuditResource(e.target.value)}>
                <option value="">{t('admin.audit_filter_all_resources','All resources')}</option>
                {auditResources.map(resource => (
                  <option key={resource} value={resource}>{t(`admin.resource.${resource}`, resource)}</option>
                ))}
              </select>
            </div>
          </div>

          {loadingAudit ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="bg-white rounded-xl border border-gray-200 h-12 animate-pulse" />)}</div>
          ) : (
            <div className="space-y-2">
              {filteredAuditLogs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                  {auditLogs.length === 0 ? t('admin.no_audit_logs','No audit logs yet') : t('admin.no_audit_logs_filtered','No audit logs match your filters')}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {filteredAuditLogs.map(log => (
                    <div key={log.id} className="flex flex-col gap-3 px-5 py-4 hover:bg-gray-50 transition-colors sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                          log.action.includes('delete') ? 'bg-red-400' :
                          log.action.includes('creat') || log.action.includes('publish') ? 'bg-emerald-400' :
                          'bg-blue-400'
                        }`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800">{auditActionLabel(log.action)}</p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                            {log.resource_type && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1">
                                {t('admin.resource_type','Resource:')} {t(`admin.resource.${log.resource_type}`, log.resource_type)}#{log.resource_id != null ? formatNumber(log.resource_id, i18n.language) : t('admin.none','None')}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1">
                              {t('admin.user_tag',{id: log.user_id != null ? formatNumber(log.user_id, i18n.language) : t('admin.system','system')})}
                            </span>
                            {log.ip_address && <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1">{t('admin.ip_address','IP:')} {log.ip_address}</span>}
                          </div>
                          {log.details != null && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {formatAuditDetails(log.details)}
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 shrink-0">{timeAgo(parseUTC(log.created_at), i18n.language)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}