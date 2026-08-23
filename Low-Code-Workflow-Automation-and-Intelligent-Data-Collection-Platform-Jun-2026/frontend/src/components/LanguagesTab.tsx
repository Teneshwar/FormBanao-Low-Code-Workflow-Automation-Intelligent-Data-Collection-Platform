import { useEffect, useState } from 'react'
import i18n from '../i18n'
import { translationsApi } from '../lib/apiModules'
import type { FormFieldOut, FormLanguageSettingsOut, FormTranslationOut, TranslationContent } from '../lib/types'
import { SUPPORTED_LANGUAGES, RTL_LANGUAGES } from '../lib/types'
import { formatNumber } from '../lib/localeUtils'
import toast from 'react-hot-toast'
import {
  Globe, Plus, Trash2, Star, Wand2, Loader2, Check, AlertTriangle, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props { formId: number; fields: FormFieldOut[] }

const LANG_LIST = Object.entries(SUPPORTED_LANGUAGES)

// ── Completion bar ─────────────────────────────────────────────────────────────
function CompletionBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
    </div>
  )
}

// ── Translation editor panel ───────────────────────────────────────────────────
function TranslationEditor({ translation, fields, onSave, onClose }: {
  translation: FormTranslationOut
  fields: FormFieldOut[]
  onSave: (content: TranslationContent) => void
  onClose: () => void
}) {
  const [content, setContent] = useState<TranslationContent>(() => ({
    title: translation.content?.title ?? '',
    description: translation.content?.description ?? '',
    submit_button: translation.content?.submit_button ?? 'Submit',
    thank_you_message: translation.content?.thank_you_message ?? 'Thank you!',
    fields: translation.content?.fields ?? {},
  }))
  const setFieldTrans = (fieldId: number, key: string, value: string) => {
    setContent(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [String(fieldId)]: { ...(prev.fields?.[String(fieldId)] ?? {}), [key]: value },
      },
    }))
  }

  const setFieldOption = (fieldId: number, optIdx: number, value: string) => {
    const existing: string[] = (content.fields?.[String(fieldId)]?.options ?? [])
  const updated = [...existing]
    updated[optIdx] = value
    setContent(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [String(fieldId)]: { ...(prev.fields?.[String(fieldId)] ?? {}), options: updated },
      },
    }))
  }

  const isRTL = RTL_LANGUAGES.has(translation.language_code)
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
    <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 modal-panel ${isRTL ? 'dir-rtl' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">{translation.language_name}</h3>
            <p className="text-xs text-gray-400">{translation.language_code.toUpperCase()} · {translation.completion_pct}% {t('languagesTab.complete','complete')}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">✕</button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Form level */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('languagesTab.form','Form')}</p>
            <div>
              <label className="label">{t('languagesTab.title','Title')}</label>
              <input className="input" value={content.title ?? ''} onChange={e => setContent(p => ({ ...p, title: e.target.value }))} dir={isRTL ? 'rtl' : 'ltr'} />
            </div>
            <div>
              <label className="label">{t('languagesTab.description','Description')}</label>
              <textarea className="input h-16 resize-none" value={content.description ?? ''} onChange={e => setContent(p => ({ ...p, description: e.target.value }))} dir={isRTL ? 'rtl' : 'ltr'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('languagesTab.submitButton','Submit Button')}</label>
                <input className="input" value={content.submit_button ?? ''} onChange={e => setContent(p => ({ ...p, submit_button: e.target.value }))} dir={isRTL ? 'rtl' : 'ltr'} />
              </div>
              <div>
                <label className="label">{t('languagesTab.thankYou','Thank You Message')}</label>
                <input className="input" value={content.thank_you_message ?? ''} onChange={e => setContent(p => ({ ...p, thank_you_message: e.target.value }))} dir={isRTL ? 'rtl' : 'ltr'} />
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{formatNumber(fields.length, i18n.language)} {t('languagesTab.fields','Fields')}</p>
            {fields.map(field => {
              const ft = content.fields?.[String(field.id)] ?? {}
              const opts = Array.isArray(field.options) ? (field.options as string[]) : []
              return (
                <div key={field.id} className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-600">{field.label} <span className="text-gray-400 font-normal">({field.field_type})</span></p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">{t('languagesTab.label','Label')}</label>
                      <input className="input text-sm" value={ft.label ?? ''} onChange={e => setFieldTrans(field.id, 'label', e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} placeholder={field.label} />
                    </div>
                    {field.placeholder && (
                      <div>
                        <label className="label">{t('languagesTab.placeholder','Placeholder')}</label>
                        <input className="input text-sm" value={ft.placeholder ?? ''} onChange={e => setFieldTrans(field.id, 'placeholder', e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} placeholder={field.placeholder ?? ''} />
                      </div>
                    )}
                  </div>
                  {opts.length > 0 && (
                    <div>
                      <label className="label">{t('languagesTab.options','Options')}</label>
                      <div className="grid grid-cols-2 gap-1">
                        {opts.map((opt, idx) => (
                          <input key={idx} className="input text-sm" dir={isRTL ? 'rtl' : 'ltr'}
                            placeholder={opt}
                            value={(ft.options ?? [])[idx] ?? ''}
                            onChange={e => setFieldOption(field.id, idx, e.target.value)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>{t('languagesTab.cancel','Cancel')}</button>
          <button className="btn-primary" onClick={() => onSave(content)}>
            <Check className="w-4 h-4" /> {t('languagesTab.saveTranslation','Save Translation')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main LanguagesTab ──────────────────────────────────────────────────────────
export default function LanguagesTab({ formId, fields }: Props) {
  const [settings, setSettings]       = useState<FormLanguageSettingsOut | null>(null)
  const [loading, setLoading]         = useState(true)
  const [translating, setTranslating] = useState(false)
  const [editing, setEditing]         = useState<FormTranslationOut | null>(null)
  const [showAddLang, setShowAddLang] = useState(false)
  const [selectedLangs, setSelectedLangs] = useState<string[]>([])
  const { t } = useTranslation()
  const load = () => {
    setLoading(true)
    translationsApi.getSettings(formId)
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [formId])
  const handleToggle = async () => {
    try { setSettings(await translationsApi.toggle(formId)); toast.success(t('languagesTab.multilingual_updated','Multilingual support updated')) }
    catch { toast.error(t('languagesTab.failed','Failed')) }
  }

  const handleAddLanguages = async () => {
    for (const lang of selectedLangs) {
      try { await translationsApi.addLanguage(formId, lang) }
      catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        if (msg !== 'Language already added') toast.error(`${lang}: ${msg ?? 'Failed'}`)
      }
    }
    setShowAddLang(false); setSelectedLangs([]); load()
    toast.success(t('languagesTab.added','Languages added'))
  }

  const handleAutoTranslate = async () => {
    if (!settings) return
    const targets = settings.languages.map(l => l.language_code).filter(l => l !== 'en')
    if (targets.length === 0) { toast.error(t('languagesTab.add_first','Add languages first')); return }
    setTranslating(true)
    try {
      await translationsApi.autoTranslate(formId, targets)
      toast.success(t('languagesTab.auto_complete','Auto-translation complete! Review and edit as needed.'))
      load()
    } catch { toast.error(t('languagesTab.auto_failed','Auto-translate failed')) }
    finally { setTranslating(false) }
  }

  const handleSaveTranslation = async (content: TranslationContent) => {
    if (!editing) return
    try {
      await translationsApi.updateTranslation(formId, editing.language_code, content)
      toast.success(t('languagesTab.translation_saved','Translation saved')); setEditing(null); load()
    } catch { toast.error(t('languagesTab.failed_save','Failed to save')) }
  }

  const handleRemove = async (lang: string) => {
    if (!confirm(t('languagesTab.remove_confirm', 'Remove {{name}} translation?', { name: SUPPORTED_LANGUAGES[lang] }))) return
    try { await translationsApi.removeLanguage(formId, lang); toast.success(t('languagesTab.removed','Removed')); load() }
    catch (e: unknown) {
      toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t('languagesTab.failed','Failed'))
    }
  }

  const handleSetDefault = async (lang: string) => {
    try { setSettings(await translationsApi.setDefault(formId, lang)); toast.success(t('languagesTab.default_updated','Default language updated')) }
    catch { toast.error(t('languagesTab.failed','Failed')) }
  }

  if (loading)
  return <div className="p-12 text-center text-gray-400">{t('languagesTab.loading_settings','Loading language settings…')}</div>

  return (
    <div className="space-y-5">
      {/* Enable toggle */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">{t('languagesTab.pageTitle','Multi-language Support')}</p>
          <p className="text-sm text-gray-400">{t('languagesTab.pageDescription','Allow respondents to fill this form in their preferred language')}</p>
        </div>
        <button onClick={handleToggle}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            settings?.multilingual_enabled
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          {settings?.multilingual_enabled
            ? <><ToggleRight className="w-4 h-4" /> {t('languagesTab.enabled','Enabled')}</>
            : <><ToggleLeft className="w-4 h-4" /> {t('languagesTab.disabled','Disabled')}</>}
        </button>
      </div>

      {settings?.multilingual_enabled && (
        <>
          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <button className="btn-secondary" onClick={() => setShowAddLang(true)}>
              <Plus className="w-4 h-4" /> {t('languagesTab.add_language','Add Language')}
            </button>
            <button className="btn-primary flex items-center gap-2" onClick={handleAutoTranslate} disabled={translating}>
              {translating ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('languagesTab.translating','Translating…')}</> : <><Wand2 className="w-4 h-4" /> {t('languagesTab.auto_translate_all','Auto Translate All')}</>}
            </button>
          </div>

          {/* Warning if incomplete */}
          {settings.languages.some(l => l.completion_pct < 100) && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {t('languagesTab.incomplete_warning','Some translations are incomplete. Respondents will see the default language for missing strings.')}
            </div>
          )}

          {/* Language cards */}
          <div className="space-y-2">
            {settings.languages.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
                <Globe className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                {t('languagesTab.no_languages_added','No languages added yet. Click "Add Language" to start.')}
              </div>
            )}
            {settings.languages.map(lang => (
              <div key={lang.language_code}
                className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">
                {/* Flag-like language code */}
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
                  {lang.language_code.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{lang.language_name}</p>
                    {lang.is_default && (
                      <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" /> {t('languagesTab.default','Default')}
                      </span>
                    )}
                    {RTL_LANGUAGES.has(lang.language_code) && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t('languagesTab.rtl','RTL')}</span>
                    )}
                  </div>
                  <CompletionBar pct={lang.completion_pct} />
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditing(lang)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-primary-300 text-gray-600 hover:text-primary-700 transition-colors">
                    {t('languagesTab.edit','Edit')}
                  </button>
                  {!lang.is_default && (
                    <button onClick={() => handleSetDefault(lang.language_code)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-amber-300 text-gray-600 hover:text-amber-700 transition-colors">
                      {t('languagesTab.set_default','Set Default')}
                    </button>
                  )}
                  {!lang.is_default && (
                    <button onClick={() => handleRemove(lang.language_code)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add language picker */}
          {showAddLang && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 modal-panel">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">{t('languagesTab.add_languages','Add Languages')}</h3>
                  <button onClick={() => setShowAddLang(false)} className="p-1 rounded-lg hover:bg-gray-100">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto mb-4">
                  {LANG_LIST.map(([code, name]) => {
                    const alreadyAdded = settings?.languages.some(l => l.language_code === code)
  const isSelected   = selectedLangs.includes(code)
  return (
                      <button key={code} disabled={alreadyAdded}
                        onClick={() => setSelectedLangs(prev =>
                          isSelected ? prev.filter(l => l !== code) : [...prev, code]
                        )}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm transition-all ${
                          alreadyAdded ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50' :
                          isSelected ? 'border-primary-500 bg-primary-50 text-primary-700' :
                          'border-gray-200 hover:border-primary-300 text-gray-700'
                        }`}>
                        <span className="text-xs font-bold w-7 text-gray-500">{code.toUpperCase()}</span>
                        <span>{name}</span>
                        {alreadyAdded && <Check className="w-3 h-3 ml-auto text-emerald-500" />}
                        {isSelected && !alreadyAdded && <Check className="w-3 h-3 ml-auto text-primary-600" />}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-3">
                  <button className="btn-secondary flex-1 justify-center" onClick={() => setShowAddLang(false)}>{t('languagesTab.cancel','Cancel')}</button>
                  <button className="btn-primary flex-1 justify-center" disabled={selectedLangs.length === 0}
                    onClick={handleAddLanguages}>
                    {t('languagesTab.add_selected_languages','Add {{formattedCount}} Language{{plural}}', { count: selectedLangs.length, formattedCount: formatNumber(selectedLangs.length, i18n.language), plural: selectedLangs.length !== 1 ? 's' : '' })}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Editor modal */}
      {editing && (
        <TranslationEditor
          translation={editing} fields={fields}
          onSave={handleSaveTranslation} onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}