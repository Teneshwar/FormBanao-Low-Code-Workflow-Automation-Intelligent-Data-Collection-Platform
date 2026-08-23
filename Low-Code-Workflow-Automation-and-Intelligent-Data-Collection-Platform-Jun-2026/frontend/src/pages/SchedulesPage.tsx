import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { schedulesApi, formsApi } from '../lib/apiModules'
import type { FormScheduleOut, FormOut, UpcomingFormOut } from '../lib/types'
import toast from 'react-hot-toast'
import { Plus, Trash2, Pencil, Clock, CalendarClock, Globe, Lock, Eye, RefreshCw } from 'lucide-react'
import { isFuture, isPast, differenceInSeconds } from 'date-fns'
import i18n from '../i18n'
import { formatNumber, formatDateLocal } from '../lib/localeUtils'

// Always parse server timestamps as UTC
function parseUTC(d: string | null): Date | null {
  if (!d)
  return null
  return new Date(d.endsWith('Z') || d.includes('+') ? d : d + 'Z')
}

// ── Live countdown component ──────────────────────────────────────────────────
function Countdown({ targetDate }: { targetDate: Date }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const totalSecs = Math.max(0, differenceInSeconds(targetDate, now))
  if (totalSecs === 0)
    return <span className="text-emerald-600 font-semibold">{t('schedules.opening_now','Opening now…')}</span>

  const days    = Math.floor(totalSecs / 86400)
  const hours   = Math.floor((totalSecs % 86400) / 3600)
  const minutes = Math.floor((totalSecs % 3600) / 60)
  const seconds = totalSecs % 60

  const parts: string[] = []
  const lang = i18n.language || 'en'
  if (days > 0)    parts.push(`${formatNumber(days, lang)}d`)
  if (hours > 0)   parts.push(`${formatNumber(hours, lang)}h`)
  if (minutes > 0) parts.push(`${formatNumber(minutes, lang)}m`)
  parts.push(`${formatNumber(seconds, lang)}s`)
  return (
    <span className="font-mono font-semibold text-amber-700 tabular-nums">
      {parts.join(' ')} {t('schedules.remaining','remaining')}
    </span>
  )
}

// ── Upcoming form card ─────────────────────────────────────────────────────
function UpcomingCard({ form }: { form: UpcomingFormOut }) {
  const { t } = useTranslation()
  const startsAt = parseUTC(form.starts_at)
  const endsAt   = parseUTC(form.ends_at)
  const isFutureDate = startsAt && isFuture(startsAt)
  return (
    <div className="bg-white rounded-2xl border border-amber-200 p-5 flex items-start gap-4">
      <div className="bg-amber-100 p-2.5 rounded-xl shrink-0">
        <CalendarClock className="w-5 h-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="font-semibold text-gray-900 truncate">{form.title}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
            {t('schedules.upcoming','Upcoming')}
          </span>
          <span className="text-xs flex items-center gap-1 text-gray-400">
            {form.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            {form.is_public ? t('schedules.public','Public') : t('schedules.private','Private')}
          </span>
        </div>
        {form.description && (
          <p className="text-sm text-gray-400 truncate mb-1">{form.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
          {/* Live countdown — correct: shows time UNTIL form opens */}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {startsAt && isFutureDate ? (
              <Countdown targetDate={startsAt} />
            ) : (
              <span>{t('schedules.opens_soon','Opens soon')}</span>
            )}
          </span>
          {startsAt && (
            <span className="text-gray-400">{t('schedules.opens','Opens:')} {formatDateLocal(startsAt, i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}</span>
          )}
          {endsAt && (
            <span className="text-gray-400">{t('schedules.closes','Closes:')} {formatDateLocal(endsAt, i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}</span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        <div className="text-xs text-center bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <Eye className="w-4 h-4 text-amber-400 mx-auto mb-0.5" />
          <p className="text-amber-600 font-medium">{t('schedules.preview_only','Preview only')}</p>
        </div>
      </div>
    </div>
  )
}

// ── Schedule status helper ─────────────────────────────────────────────────
function getScheduleStatus(s: FormScheduleOut) {
  const starts = parseUTC(s.starts_at)
  const ends   = parseUTC(s.ends_at)

  if (starts && isFuture(starts))
    return { label: 'upcoming', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
  if (ends && isPast(ends))
    return { label: 'ended',    cls: 'bg-gray-100 text-gray-500 border-gray-200' }
  if ((!starts || !isFuture(starts)) && (!ends || isFuture(ends)))
    return { label: 'active',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  return { label: 'inactive', cls: 'bg-gray-100 text-gray-500 border-gray-200' }
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function SchedulesPage() {
  const [schedules, setSchedules]   = useState<FormScheduleOut[]>([])
  const [forms, setForms]           = useState<FormOut[]>([])
  const [upcoming, setUpcoming]     = useState<UpcomingFormOut[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<FormScheduleOut | null>(null)
  const { t } = useTranslation()
  const load = () => {
    setLoading(true)
    Promise.all([schedulesApi.list(), formsApi.list(), schedulesApi.upcoming()])
      .then(([s, f, u]) => {
        setSchedules(s)
        setForms(f)
        setUpcoming(u)
      })
      .catch(() => toast.error(t('schedules.load_failed','Failed to load schedules')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  const formTitle = (id: number) => forms.find(f => f.id === id)?.title ?? t('schedules.form_number','Form #{{id}}', { id: formatNumber(id, i18n.language) })
const fmtDate = (d: string | null) => {
    if (!d) return '—'
    try {
      const parsed = parseUTC(d)
      return parsed ? formatDateLocal(parsed, i18n.language, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
    } catch { return d }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('schedules.delete_confirm','Delete this schedule?'))) return
    try { await schedulesApi.delete(id); toast.success(t('schedules.deleted','Schedule deleted')); load() }
    catch { toast.error(t('schedules.delete_failed','Failed to delete')) }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('schedules.title','Schedules')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {t('schedules.description','Control when forms open and close automatically. Forms with a future open time appear as "upcoming" to users.')}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={load} title={t('schedules.refresh','Refresh')}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" /> {t('schedules.new_schedule','New Schedule')}
          </button>
        </div>
      </div>

      {/* How it works banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">{t('schedules.how_it_works','How scheduling works:')}</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700 text-xs">
          <li><strong>{t('schedules.opens_at','Opens At')}</strong> — {t('schedules.opens_at_desc','form becomes visible and fillable at this time (auto-publish)')}</li>
          <li><strong>{t('schedules.closes_at','Closes At')}</strong> — {t('schedules.closes_at_desc','form stops accepting responses and gets archived at this time')}</li>
          <li><strong>{t('schedules.upcoming','Upcoming')}</strong> — {t('schedules.upcoming_desc','before open time, the form shows as "upcoming" on dashboards (preview only)')}</li>
          <li>{t('schedules.leave_blank','You can also leave either field blank for open-ended windows')}</li>
        </ul>
      </div>

      {/* Upcoming forms section */}
      {!loading && upcoming.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-amber-500" /> {t('schedules.upcoming_forms','Upcoming Forms')}
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{formatNumber(upcoming.length, i18n.language)}</span>
          </h2>
          <div className="space-y-3">
            {upcoming.map(f => <UpcomingCard key={f.id} form={f} />)}
          </div>
        </div>
      )}

      {/* Schedules list */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">{t('schedules.all_schedules','All Schedules')}</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-2xl border border-gray-200 h-20 animate-pulse" />)}
          </div>
        ) : schedules.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
            <CalendarClock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">{t('schedules.no_schedules','No schedules yet')}</p>
            <p className="text-gray-400 text-sm mt-1">{t('schedules.create_first','Create a schedule to control when a form accepts responses')}</p>
            <button className="btn-primary mt-4" onClick={() => { setEditing(null); setShowModal(true) }}>
              <Plus className="w-4 h-4" /> {t('schedules.create_schedule','Create Schedule')}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {schedules.map(s => {
              const st = getScheduleStatus(s)
              return (
                <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-gray-900 truncate">{formTitle(s.form_id)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${st.cls}`}>{t(`schedules.status.${st.label}`, st.label)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">{t('schedules.opens','Opens:')}</span> {fmtDate(s.starts_at)}
                      </span>
                      <span className="text-gray-300">→</span>
                      <span className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">{t('schedules.closes','Closes:')}</span> {fmtDate(s.ends_at)}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      {s.auto_publish && (
                        <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">
                          {t('schedules.auto_publish','Auto-publish at open')}
                        </span>
                      )}
                      {s.auto_archive && (
                        <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
                          {t('schedules.auto_archive','Auto-archive at close')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      onClick={() => { setEditing(s); setShowModal(true) }}
                      title={t('schedules.edit','Edit')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                      onClick={() => handleDelete(s.id)}
                      title={t('schedules.delete','Delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <ScheduleModal
          schedule={editing}
          forms={forms}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────
function ScheduleModal({ schedule, forms, onClose, onSaved }: {
  schedule: FormScheduleOut | null
  forms: FormOut[]
  onClose: () => void
  onSaved: () => void
}) {
  // Convert ISO UTC string to local datetime-local format (YYYY-MM-DDTHH:MM)
  const toLocal = (iso: string | null) => {
    if (!iso)
  return ''
    try {
      const d = parseUTC(iso)
      if (!d)
  return ''
const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    } catch { return '' }
  }

  const [formId,      setFormId]      = useState(schedule?.form_id ?? forms[0]?.id ?? 0)
  const [startsAt,    setStartsAt]    = useState(toLocal(schedule?.starts_at ?? null))
  const [endsAt,      setEndsAt]      = useState(toLocal(schedule?.ends_at ?? null))
  const [autoPublish, setAutoPublish] = useState(schedule?.auto_publish ?? true)
  const [autoArchive, setAutoArchive] = useState(schedule?.auto_archive ?? true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const { t } = useTranslation()
  const handleSave = async () => {
    setError('')
    // Validate: if both set, start must be before end
    if (startsAt && endsAt) {
      if (new Date(startsAt) >= new Date(endsAt)) {
        setError(t('schedules.error_start_before_end','Open time must be before close time'))
        return
      }
    }

    setSaving(true)
    try {
      const payload: {
        starts_at?: string; ends_at?: string;
        auto_publish: boolean; auto_archive: boolean;
      } = {
        auto_publish: autoPublish,
        auto_archive: autoArchive,
      }
      // Only include datetime fields if they are set
      if (startsAt) payload.starts_at = new Date(startsAt).toISOString()
      else payload.starts_at = undefined

      if (endsAt) payload.ends_at = new Date(endsAt).toISOString()
      else payload.ends_at = undefined

      if (schedule) {
        await schedulesApi.update(schedule.id, payload)
        toast.success(t('schedules.updated','Schedule updated'))
      } else {
        if (!formId) { setError(t('schedules.select_form','Please select a form')); setSaving(false); return }
        await schedulesApi.create({ form_id: formId, ...payload })
        toast.success(t('schedules.created','Schedule created — form will auto-publish at the open time'))
      }
      onSaved()
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (status === 409) {
        setError(t('schedules.already_has_schedule','This form already has a schedule. Edit the existing one instead.'))
      } else {
        setError(msg || t('schedules.save_failed','Failed to save schedule'))
      }
    } finally { setSaving(false) }
  }

  const availableForms = schedule
    ? forms  // editing: show all
    : forms  // creating: show all so admin can pick any

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 modal-panel">
        <h2 className="text-lg font-semibold text-gray-900">
          {schedule ? t('schedules.edit_schedule','Edit Schedule') : t('schedules.new_schedule','New Schedule')}
        </h2>

        {!schedule && (
          <div>
            <label className="label">{t('schedules.form_label','Form *')}</label>
            <select className="input" value={formId} onChange={e => setFormId(Number(e.target.value))}>
              {availableForms.length === 0
                ? <option value="">{t('schedules.no_forms_available','No forms available')}</option>
                : availableForms.map(f => (
                    <option key={f.id} value={f.id}>{f.title} ({f.status})</option>
                  ))
              }
            </select>
          </div>
        )}

        {schedule && (
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
            <p className="text-xs text-gray-400 mb-0.5">{t('schedules.editing_for','Editing schedule for:')}</p>
            <p className="font-medium text-gray-800">{forms.find(f => f.id === schedule.form_id)?.title ?? t('schedules.form_number','Form #{{id}}', { id: schedule.form_id })}</p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="label">{t('schedules.opens_at_label','Opens At')} <span className="text-gray-400 font-normal">{t('schedules.opens_at_hint','(leave blank for immediately)')}</span></label>
            <input
              type="datetime-local"
              className="input"
              value={startsAt}
              onChange={e => setStartsAt(e.target.value)}
            />
            {startsAt && (
              <p className="text-xs text-gray-400 mt-1">
                {isFuture(new Date(startsAt))
                  ? <span className="text-amber-600 font-medium">⏰ {t('schedules.opens_in','Opens in')} <Countdown targetDate={new Date(startsAt)} /></span>
                  : t('schedules.opens_in_past','⚠️ This time is in the past — form will open immediately')}
              </p>
            )}
          </div>
          <div>
            <label className="label">{t('schedules.closes_at_label','Closes At')} <span className="text-gray-400 font-normal">{t('schedules.closes_at_hint','(leave blank for no end)')}</span></label>
            <input
              type="datetime-local"
              className="input"
              value={endsAt}
              onChange={e => setEndsAt(e.target.value)}
            />
            {endsAt && (
              <p className="text-xs text-gray-400 mt-1">
                {isFuture(new Date(endsAt))
                  ? t('schedules.closes_on','⏰ Closes {{when}}', { when: formatDateLocal(new Date(endsAt), i18n.language, { dateStyle: 'medium', timeStyle: 'short' }) })
                  : t('schedules.closes_in_past','⚠️ This time is in the past — form will be archived immediately')}
              </p>
            )}
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={autoPublish}
              onChange={e => setAutoPublish(e.target.checked)}
              className="w-4 h-4 rounded accent-primary-600"
            />
            <div>
              <p className="font-medium text-gray-800">{t('schedules.auto_publish_when_open','Auto-publish when form opens')}</p>
              <p className="text-xs text-gray-400">{t('schedules.auto_publish_desc','Automatically make the form live at the open time')}</p>
            </div>
          </label>
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={autoArchive}
              onChange={e => setAutoArchive(e.target.checked)}
              className="w-4 h-4 rounded accent-primary-600"
            />
            <div>
              <p className="font-medium text-gray-800">{t('schedules.auto_archive_when_close','Auto-archive when form closes')}</p>
              <p className="text-xs text-gray-400">{t('schedules.auto_archive_desc','Automatically stop responses at the close time')}</p>
            </div>
          </label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button className="btn-secondary" onClick={onClose}>{t('schedules.cancel','Cancel')}</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t('schedules.saving','Saving…') : (schedule ? t('schedules.update_schedule','Update Schedule') : t('schedules.create_schedule','Create Schedule'))}
          </button>
        </div>
      </div>
    </div>
  )
}
