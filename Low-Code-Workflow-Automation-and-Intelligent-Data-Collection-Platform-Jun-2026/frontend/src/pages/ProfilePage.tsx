import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { profileApi, formsApi } from '../lib/apiModules'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { User, Lock, Trash2, Save, Bell, Shield, FileText, Send, Calendar, Sun, Moon, Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { changeAppLanguage, SUPPORTED_LANGS } from '../i18n'
import { formatDateLocal, formatNumber } from '../lib/localeUtils'

function parseUTC(d: string): Date {
  return new Date(d.endsWith('Z') || d.includes('+') ? d : d + 'Z')
}

interface ProfileForm { full_name: string }
interface PasswordForm { current_password: string; new_password: string; confirm: string }

const NOTIF_KEY = 'notif_prefs'
const THEME_KEY = 'app_theme'
type AppTheme = 'light' | 'dark' | 'system'
function applyTheme(theme: AppTheme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (prefersDark) root.classList.add('dark'); else root.classList.remove('dark')
  }
  localStorage.setItem(THEME_KEY, theme)
}
interface NotifPrefs { on_submission: boolean; on_publish: boolean; on_password_change: boolean }
const loadPrefs  = (): NotifPrefs => { try { return { on_submission:true, on_publish:true, on_password_change:true, ...JSON.parse(localStorage.getItem(NOTIF_KEY)||'{}') } } catch { return { on_submission:true, on_publish:true, on_password_change:true } } }
const savePrefs  = (p: NotifPrefs) => localStorage.setItem(NOTIF_KEY, JSON.stringify(p))

export default function ProfilePage() {
  const { t, i18n } = useTranslation()
  const languageOptions = SUPPORTED_LANGS.map(code => ({
    value: code,
    label: code === 'en' ? 'English' : code === 'hi' ? 'हिन्दी' : code === 'mr' ? 'मराठी' : code === 'bn' ? 'বাংলা' : code === 'ta' ? 'தமிழ்' : code === 'te' ? 'తెలుగు' : code === 'kn' ? 'ಕನ್ನಡ' : code === 'gu' ? 'ગુજરાતી' : code === 'pa' ? 'ਪੰਜਾਬੀ' : code === 'ml' ? 'മലയാളം' : code === 'ur' ? 'اردو' : code.toUpperCase(),
  }))
  const { user, refresh, logout } = useAuth()
  const navigate = useNavigate()
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(loadPrefs)
  const [formCount, setFormCount]   = useState<number | null>(null)
  const [theme, setTheme]           = useState<AppTheme>((localStorage.getItem(THEME_KEY) as AppTheme) || 'light')
  const profileForm = useForm<ProfileForm>({ defaultValues: { full_name: user?.full_name || '' } })
  const passForm    = useForm<PasswordForm>()

  useEffect(() => {
    formsApi.list().then(f => setFormCount(f.length)).catch(() => {})
  }, [])
  const onProfileSave = async (data: ProfileForm) => {
    try { await profileApi.update({ full_name: data.full_name }); await refresh(); toast.success(t('messages.saved')) }
    catch { toast.error(t('messages.failed')) }
  }

  const onPasswordSave = async (data: PasswordForm) => {
    if (data.new_password !== data.confirm) { toast.error(t('auth.passwordsDoNotMatch')); return }
    try {
      await profileApi.update({ current_password: data.current_password, new_password: data.new_password })
      toast.success(t('messages.saved')); passForm.reset()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || t('messages.failed'))
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm(t('profile.deleteConfirm','This will permanently delete your account and all your data. Are you sure?'))) return
    setDeletingAccount(true)
    try { await profileApi.deleteAccount(); await logout(); toast.success(t('messages.deleted')); navigate('/login') }
    catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || t('messages.failed'))
    } finally { setDeletingAccount(false) }
  }

  const toggleNotif = (key: keyof NotifPrefs) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] }
    setNotifPrefs(updated); savePrefs(updated); toast.success(t('profile.preferenceSaved','Preference saved'))
  }

  const initials = (user?.full_name || user?.email || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('profile.title','Profile')}</h1>
        <p className="text-gray-500 text-sm mt-0.5">{t('profile.subtitle','Manage your account settings')}</p>
      </div>

      {/* ── Avatar + account overview ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start gap-5 mb-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900">{user?.full_name || t('profile.noNameSet','No name set')}</h2>
            <p className="text-gray-500 text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {user?.is_superuser && (
                <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full">
                  <Shield className="w-3 h-3"/>{t('profile.admin')}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                user?.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200'
              }`}>{user?.is_active ? t('profile.active') : t('profile.inactive')}</span>
              {user?.created_at && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3"/>{t('profile.joined','Joined {{date}}', { date: formatDateLocal(parseUTC(user.created_at), i18n.language, { dateStyle: 'medium' }) })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg"><FileText className="w-4 h-4 text-blue-600"/></div>
            <div>
              <p className="text-lg font-bold text-gray-900">{formCount != null ? formatNumber(formCount, i18n.language) : '—'}</p>
              <p className="text-xs text-gray-500">{t('profile.formsCreated','Forms created')}</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg"><Send className="w-4 h-4 text-emerald-600"/></div>
            <div>
              <p className="text-lg font-bold text-gray-900">—</p>
              <p className="text-xs text-gray-500">{t('profile.submissionsMade','Submissions made')}</p>
            </div>
          </div>
        </div>

        {/* Edit name */}
        <form onSubmit={profileForm.handleSubmit(onProfileSave)} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label"><User className="w-3.5 h-3.5 inline mr-1"/>{t('auth.fullName','Full Name')}</label>
              <input className="input" placeholder={t('profile.fullNamePlaceholder','Your full name')} {...profileForm.register('full_name')} />
            </div>
            <div>
              <label className="label">{t('auth.email')} <span className="text-gray-400 font-normal">({t('profile.readOnly','read-only')})</span></label>
              <input className="input bg-gray-50 text-gray-500" value={user?.email || ''} disabled />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={profileForm.formState.isSubmitting}>
            <Save className="w-4 h-4"/> {t('buttons.save')}
          </button>
        </form>
      </div>

      {/* ── Change password ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-500"/> {t('profile.changePassword','Change Password')}
        </h2>
        <form onSubmit={passForm.handleSubmit(onPasswordSave)} className="space-y-4">
          <div>
            <label className="label">{t('auth.currentPassword','Current Password')}</label>
            <input type="password" className="input" {...passForm.register('current_password', { required: true })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('auth.newPassword','New Password')}</label>
              <input type="password" className="input"
                {...passForm.register('new_password', { required: true, minLength: { value: 6, message: t('auth.minLength6','Min 6 characters') } })} />
              {passForm.formState.errors.new_password && (
                <p className="text-red-500 text-xs mt-1">{passForm.formState.errors.new_password.message}</p>
              )}
            </div>
            <div>
              <label className="label">{t('auth.confirmNewPassword','Confirm New Password')}</label>
              <input type="password" className="input" {...passForm.register('confirm', { required: true })} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={passForm.formState.isSubmitting}>
            {t('profile.updatePassword','Update Password')}
          </button>
        </form>
      </div>

      {/* ── Notifications ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500"/> {t('profile.emailNotifications','Email Notifications')}
        </h2>
        <p className="text-xs text-gray-400 mb-4">{t('profile.emailNotifNote','Takes effect when SMTP is configured on the server.')}</p>
        <div className="space-y-1">
          {([
          { key:'on_submission',     label:t('profile.notif.newSubmission','New form submission'),   desc:t('profile.notif.newSubmissionDesc','When someone fills your form') },
          { key:'on_publish',        label:t('profile.notif.formPublished','Form published'),        desc:t('profile.notif.formPublishedDesc','When you publish a form') },
          { key:'on_password_change',label:t('profile.notif.passwordChanged','Password changed'),      desc:t('profile.notif.passwordChangedDesc','Security alert on password update') },
          ] as { key: keyof NotifPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <button type="button" onClick={() => toggleNotif(key)} role="switch" aria-checked={notifPrefs[key]}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${notifPrefs[key] ? 'bg-primary-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${notifPrefs[key] ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Appearance / Theme ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Sun className="w-4 h-4 text-gray-500" /> {t('profile.appearanceTitle','Appearance')}
        </h2>
        <p className="text-xs text-gray-400 mb-4">{t('profile.appearanceNote','Choose how the app looks. Changes take effect immediately.')}</p>
        <div className="grid grid-cols-3 gap-3">
          {([
          { key: 'light',  label: t('profile.appearance.light','Light'),  icon: <Sun className="w-5 h-5" />,     desc: t('profile.appearance.lightDesc','Classic light mode') },
          { key: 'dark',   label: t('profile.appearance.dark','Dark'),   icon: <Moon className="w-5 h-5" />,    desc: t('profile.appearance.darkDesc','Easy on the eyes') },
          { key: 'system', label: t('profile.appearance.system','System'), icon: <Monitor className="w-5 h-5" />, desc: t('profile.appearance.systemDesc','Follows your OS') },
          ] as { key: AppTheme; label: string; icon: React.ReactNode; desc: string }[]).map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => { setTheme(opt.key); applyTheme(opt.key); toast.success(t('profile.themeEnabled','{{mode}} mode enabled',{ mode: opt.label })) }}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                theme === opt.key
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <div className={theme === opt.key ? 'text-primary-600' : 'text-gray-400'}>{opt.icon}</div>
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="text-xs text-gray-400">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-lg">🌐</span> {t('nav.language','Language')}
        </h2>
        <div className="space-y-2">
          <label className="label">{t('nav.language','Language')}</label>
          <select
            value={i18n.language}
            onChange={e => changeAppLanguage(e.target.value, user?.id)}
            className="input"
            aria-label={t('nav.language','Language')}
          >
            {languageOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Danger zone ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-red-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-red-700 mb-2 flex items-center gap-2">
          <Trash2 className="w-4 h-4"/> {t('profile.dangerZone','Danger Zone')}
        </h2>
        <p className="text-sm text-gray-500 mb-4">{t('profile.dangerDesc','Permanently deletes your account, forms, and all associated data. Cannot be undone.')}</p>
        <button className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          onClick={handleDeleteAccount} disabled={deletingAccount}>
          {deletingAccount ? t('profile.deleting','Deleting…') : t('profile.deleteMyAccount','Delete My Account')}
        </button>
      </div>
    </div>
  )
}