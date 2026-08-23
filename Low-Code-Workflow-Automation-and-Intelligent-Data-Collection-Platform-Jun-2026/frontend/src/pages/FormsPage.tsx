import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formsApi, aiApi, fieldsApi } from '../lib/apiModules'
import type { FormOut } from '../lib/types'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, Trash2, Eye, BarChart2, ExternalLink,
  Globe, Lock, Copy, Check, QrCode, X, GitBranch,
  Archive, Clock, FileText, Sparkles, Wand2, Loader2, StopCircle, RefreshCw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { formatDateLocal, timeAgo, formatNumber } from '../lib/localeUtils'

// ── FormsPage updated_at fix: ensure UTC parsing ─────────────────────────────
function parseUTC(dateStr: string): Date {
  // Add Z if missing to ensure browser parses as UTC not local time
  if (dateStr && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
    return new Date(dateStr + 'Z')
  }
  return new Date(dateStr)
}
function QrModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const { t } = useTranslation()
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(url)}`
return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 text-center modal-panel">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 truncate flex-1 text-left">{title}</h3>
          <button onClick={onClose} className="ml-2 p-1 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 mb-4 inline-block">
          <img src={qrSrc} alt="QR Code" className="w-[200px] h-[200px]" />
        </div>
        <p className="text-xs text-gray-400 break-all mb-3">{url}</p>
        <button
          onClick={() => { navigator.clipboard.writeText(url); toast.success(t('forms.link_copied','Link copied!')) }}
          className="w-full btn-primary justify-center text-sm"
        >
          <Copy className="w-3.5 h-3.5" /> {t('forms.copy_link','Copy Link')}
        </button>
      </div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, acceptsResponses }: { status: string; acceptsResponses: boolean }) {
  const { t } = useTranslation()
  if (!acceptsResponses && status === 'published')
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      <StopCircle className="w-3 h-3" />{t('forms.closed','Closed')}
    </span>
  )
  if (status === 'published')
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{t('forms.published','Published')}
    </span>
  )
  if (status === 'archived')
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      <Archive className="w-3 h-3" />{t('forms.archived','Archived')}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      <Clock className="w-3 h-3" />{t('forms.draft','Draft')}
    </span>
  )
}

// ── Version history panel ─────────────────────────────────────────────────────
function VersionPanel({ form, onClose }: { form: FormOut; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">{t('forms.version_history','Version History')}</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{form.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {[...form.versions].reverse().map((v, i) => (
            <div key={v.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
              <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                v.status === 'published' ? 'bg-emerald-100 text-emerald-700' :
                v.status === 'archived'  ? 'bg-gray-100 text-gray-500' :
                'bg-amber-100 text-amber-700'
              }`}>
                {t('forms.version_with_number','v{{num}}', { num: v.version_number })}
              </div>              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{t('forms.version_label','Version {{num}}',{num:v.version_number})}</span>
                  {i === 0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{t('forms.latest','Latest')}</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${
                    v.status === 'published' ? 'bg-emerald-50 text-emerald-700' :
                    v.status === 'archived'  ? 'bg-gray-50 text-gray-500' :
                    'bg-amber-50 text-amber-700'
                  }`}>{t(`status.${v.status}`, { defaultValue: v.status })}</span>
                </div>
                {v.change_summary && (
                  <p className="text-xs text-gray-500 mt-0.5">{v.change_summary}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {v.published_at
                    ? `${t('forms.published_on','Published')} ${formatDateLocal(parseUTC(v.published_at), i18n.language, { dateStyle: 'medium' })}`
                    : `${t('forms.created_on','Created')} ${formatDateLocal(parseUTC(v.created_at), i18n.language, { dateStyle: 'medium' })}`}
                  {' · '}{formatNumber(v.fields.length, i18n.language)} {t('forms.fields_count', { count: v.fields.length, defaultValue: v.fields.length === 1 ? 'field' : 'fields' })}
                </p>
              </div>
            </div>
          ))}
          {form.versions.length === 0 && (
            <p className="text-center text-gray-400 py-8">{t('forms.no_versions','No versions yet.')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── AI form type detection ────────────────────────────────────────────────────
const FORM_TYPE_SUGGESTIONS: Record<string, { icon: string; label: string; extra: string[] }> = {
  contact:      { icon: '📬', label: 'Contact Form',     extra: ['Company Name', 'Best time to call', 'Attachment'] },
  survey:       { icon: '📊', label: 'Survey',           extra: ['NPS Score', 'Product Category', 'Age Range'] },
  registration: { icon: '📝', label: 'Registration',     extra: ['Emergency Contact', 'ID Number', 'Referral Code'] },
  event:        { icon: '🎟️', label: 'Event RSVP',       extra: ['Session Preference', 'T-shirt Size', 'Accessibility Needs'] },
  job:          { icon: '💼', label: 'Job Application',  extra: ['Expected Salary', 'Notice Period', 'References'] },
  medical:      { icon: '🏥', label: 'Medical Form',     extra: ['Insurance Number', 'Emergency Contact', 'Current Medications'] },
  feedback:     { icon: '💬', label: 'Feedback Form',    extra: ['Product Version', 'Screenshot Upload', 'Priority Level'] },
  order:        { icon: '🛒', label: 'Order Form',       extra: ['Shipping Address', 'Payment Method', 'Promo Code'] },
}

function detectFormType(prompt: string): string {
  const p = prompt.toLowerCase()
  if (/contact|reach|inquiry|enquiry|get in touch/.test(p))
  return 'contact'
if (/survey|feedback|opinion|satisfaction/.test(p))
  return 'survey'
if (/register|signup|sign up|account|member|enrollment/.test(p))
  return 'registration'
if (/event|meeting|conference|webinar|rsvp|attend/.test(p))
  return 'event'
if (/job|application|career|resume|cv|hiring/.test(p))
  return 'job'
if (/medical|health|patient|appointment|doctor|clinic/.test(p))
  return 'medical'
if (/order|purchase|buy|product|delivery|shipping/.test(p))
  return 'order'
return 'generic'
}

// ── Create form modal ─────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (id: number) => void }) {
  const { t } = useTranslation()
  const [mode, setMode]               = useState<'manual' | 'ai'>('manual')
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic]       = useState(true)
  const [prompt, setPrompt]           = useState('')
  const [generating, setGenerating]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [detectedType, setDetectedType] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [editingIdx, setEditingIdx]   = useState<number | null>(null)
  const [aiStep, setAiStep]           = useState<'prompt'|'preview'>('prompt')
  type PreviewField = { label?: string; field_type?: string; is_required?: boolean; placeholder?: string | null; options?: unknown }
  const [preview, setPreview]         = useState<{ title: string; description: string; fields: PreviewField[] } | null>(null)
  const FIELD_TYPE_OPTIONS = ['text','email','tel','number','textarea','select','radio','checkbox','date','datetime','rating','scale','toggle','file','url','signature','color','address']

  const handlePromptChange = (val: string) => {
    setPrompt(val)
    if (val.trim().length > 5) {
      const type = detectFormType(val)
      setDetectedType(type); setSuggestions(FORM_TYPE_SUGGESTIONS[type]?.extra ?? [])
    } else { setDetectedType(''); setSuggestions([]) }
  }

  // Auto-detect field count from prompt complexity — no picker needed
  const autoFieldCount = (p: string) => {
    const w = p.split(/\s+/).length
    if (w < 8)
  return 4; if (w < 15)
  return 6; if (w < 25)
  return 8; if (w < 40)
  return 10; return 12
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    try {
      const result = await aiApi.generate(prompt.trim(), autoFieldCount(prompt))
      setPreview(result); setTitle(result.title); setDescription(result.description)
      setAiStep('preview')
    } catch { toast.error(t('forms.generation_failed','Generation failed — try again')) }
    finally { setGenerating(false) }
  }

  const addSuggestion = (label: string) => {
    if (!preview) return
    const ft = /upload|attachment/i.test(label) ? 'file' : /date|time/i.test(label) ? 'date'
      : /number|count|amount|salary/i.test(label) ? 'number' : /address/i.test(label) ? 'address'
      : /signature/i.test(label) ? 'signature' : 'text'
    setPreview(p => p ? { ...p, fields: [...p.fields, { label, field_type: ft, is_required: false }] } : p)
    setSuggestions(s => s.filter(x => x !== label))
  }

  const handleCreate = async () => {
    const titleText = (title || preview?.title || 'New Form').trim()
    setSaving(true)
    try {
      const form = await formsApi.create({ title: titleText, description: (description || preview?.description || '').trim() || undefined, is_public: isPublic })
      if (mode === 'ai' && preview) {
        for (let i = 0; i < preview.fields.length; i++) {
          const f = preview.fields[i]
          const field_name = (f.label||`field_${i}`).toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,40)||`field_${i}`
          await fieldsApi.add(form.id, { ...f, field_name, order_index: i })
        }
      }
      toast.success(t('forms.created','Form created!'))
      onCreate(form.id)
    } catch { toast.error(t('forms.create_failed','Failed to create form')) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 modal-panel">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {mode === 'ai' && aiStep === 'preview' && (
              <button onClick={() => { setAiStep('prompt'); setPreview(null) }}
                className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-sm">{t('forms.back','← Back')}</button>
            )}
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === 'ai' && aiStep === 'preview' ? t('forms.review_edit_generated','Review & Edit Generated Form') : t('forms.create_new_form','Create New Form')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        {/* Mode toggle — hidden on preview step */}
        {!(mode === 'ai' && aiStep === 'preview') && (
          <div className="flex gap-2 p-4 border-b border-gray-100">
            <button onClick={() => { setMode('manual'); setAiStep('prompt') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${mode==='manual' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              <FileText className="w-4 h-4" /> {t('forms.manual_mode','Manual')}
            </button>
            <button onClick={() => { setMode('ai'); setAiStep('prompt') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${mode==='ai' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              <Sparkles className="w-4 h-4" /> {t('forms.ai_mode','AI Generator')}
            </button>
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* AI STEP 1: Prompt */}
          {mode === 'ai' && aiStep === 'prompt' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-2xl p-5 border border-violet-200">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                  <p className="text-sm font-semibold text-violet-800">{t('forms.describe_form','Describe your form')}</p>
                  {detectedType && FORM_TYPE_SUGGESTIONS[detectedType] && (
                    <span className="ml-auto text-xs bg-white text-violet-700 border border-violet-300 px-2 py-0.5 rounded-full">
                      {FORM_TYPE_SUGGESTIONS[detectedType].icon} {t(`forms.suggestion.${detectedType}.label`, { defaultValue: FORM_TYPE_SUGGESTIONS[detectedType].label })}
                    </span>
                  )}
                </div>
                <textarea
                  className="w-full bg-white rounded-xl border border-violet-200 px-4 py-3 text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder={t('forms.prompt_placeholder','e.g. A job application form for a software engineer — collect personal info, work experience, GitHub link, skills, and expected salary')}
                  value={prompt} onChange={e => handlePromptChange(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter' && e.ctrlKey && prompt.trim()) handleGenerate() }}
                  autoFocus
                />
                <p className="text-xs text-violet-500 mt-2">
                  {t('forms.ai_will_auto','💡 AI will auto-decide how many fields to generate based on your description')} · <kbd className="bg-violet-100 px-1 rounded">{t('forms.shortcut_ctrl_enter','Ctrl+Enter')}</kbd> {t('forms.to_generate','to generate')}
                </p>
              </div>
              <button onClick={handleGenerate} disabled={!prompt.trim() || generating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('forms.generating','Generating your form…')}</> : <><Wand2 className="w-4 h-4" /> {t('forms.generate_form','Generate Form')}</>}
              </button>
            </div>
          )}

          {/* AI STEP 2: Preview & Edit */}
          {mode === 'ai' && aiStep === 'preview' && preview && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="label">{t('forms.form_title_label','Form Title')}</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('forms.form_title_placeholder','Enter a title for your form')} /></div>
                <div><label className="label">{t('forms.description_label','Description')}</label><input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('forms.description_label_placeholder','Briefly describe the form')} /></div>
              </div>
              {suggestions.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-2">{t('forms.ai_recommends','💡 AI recommends adding:')}</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, idx) => (
                      <button key={s} onClick={() => addSuggestion(s)}
                        className="text-xs bg-white border border-amber-300 text-amber-800 px-2.5 py-1 rounded-lg hover:bg-amber-100 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> {t(`forms.suggestion.extra.${detectedType}.${idx}`, { defaultValue: s })}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {formatNumber(preview.fields.length, i18n.language)} {t('forms.fields','fields')} · {t('forms.click_label_to_rename','click label to rename')} · {t('forms.required_marker','* = required')}
                  </p>
                </div>
                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {preview.fields.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 group">
                      <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs flex items-center justify-center font-bold shrink-0">{i+1}</span>
                      {editingIdx === i ? (
                        <input className="flex-1 text-sm border-b border-violet-400 bg-transparent focus:outline-none py-0.5" autoFocus value={f.label}
                          onChange={e => setPreview(p => { if(!p)
  return p; const fs=[...p.fields]; fs[i]={...fs[i],label:e.target.value}; return {...p,fields:fs} })}
                          onBlur={() => setEditingIdx(null)} onKeyDown={e => { if(e.key==='Enter') setEditingIdx(null) }} />
                      ) : (
                        <span className="flex-1 text-sm text-gray-800 cursor-text hover:text-violet-700" onClick={() => setEditingIdx(i)}>{f.label}</span>
                      )}
                      <select value={f.field_type}
                        onChange={e => setPreview(p => { if(!p)
  return p; const fs=[...p.fields]; fs[i]={...fs[i],field_type:e.target.value}; return {...p,fields:fs} })}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-500 bg-white focus:outline-none max-w-[100px]">
                        {FIELD_TYPE_OPTIONS.map(ft => (
                          <option key={ft} value={ft}>{t(`fields.${ft}.label`, { defaultValue: ft })}</option>
                        ))}
                      </select>
                      <button onClick={() => setPreview(p => { if(!p)
  return p; const fs=[...p.fields]; fs[i]={...fs[i],is_required:!fs[i].is_required}; return {...p,fields:fs} })}
                        className={`text-sm font-bold px-1 ${f.is_required ? 'text-red-500' : 'text-gray-300 hover:text-gray-500'}`}>*</button>
                      <button onClick={() => setPreview(p => p ? {...p, fields: p.fields.filter((_,j) => j!==i)} : p)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                  <button onClick={() => setPreview(p => p ? {...p, fields:[...p.fields,{label:t('forms.new_field','New Field'),field_type:'text',is_required:false}]} : p)}
                    className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> {t('forms.add_field_manually','Add field manually')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Manual mode fields */}
          {mode === 'manual' && (
            <>
              <div><label className="label">{t('forms.form_title_label','Form Title *')}</label>
                <input className="input" placeholder={t('forms.form_title_placeholder','e.g. Customer Feedback Survey')} value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
              <div><label className="label">{t('forms.description_label','Description')} <span className="text-gray-400 font-normal">({t('forms.optional','optional')})</span></label>
                <textarea className="input h-16 resize-none" placeholder={t('forms.description_placeholder','What is this form for?')} value={description} onChange={e => setDescription(e.target.value)} /></div>
            </>
          )}

          {/* Visibility (manual always, AI only on preview step) */}
          {(mode === 'manual' || (mode === 'ai' && aiStep === 'preview')) && (
            <div>
              <label className="label">{t('forms.visibility','Visibility')}</label>
              <div className="grid grid-cols-2 gap-3">
                {[{val:true,icon:<Globe className="w-4 h-4"/>,label:t('forms.visibility_public','Public'),desc:t('forms.visibility_public_desc','Anyone can fill')},{val:false,icon:<Lock className="w-4 h-4"/>,label:t('forms.visibility_private','Private'),desc:t('forms.visibility_private_desc','Registered users only')}].map(opt => (
                  <button key={String(opt.val)} type="button" onClick={() => setIsPublic(opt.val)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${isPublic===opt.val ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className={isPublic===opt.val ? 'text-primary-600' : 'text-gray-400'}>{opt.icon}</span>
                    <div><p className="text-sm font-medium">{opt.label}</p><p className="text-xs text-gray-400">{opt.desc}</p></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {(mode === 'manual' || (mode === 'ai' && aiStep === 'preview')) && (
            <div className="flex gap-3 pt-1">
              <button type="button" className="btn-secondary flex-1 justify-center" onClick={onClose}>{t('forms.cancel','Cancel')}</button>
              <button type="button" onClick={handleCreate} disabled={saving||(mode==='manual'?!title.trim():!preview)}
                className={`flex-1 justify-center flex items-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${mode==='ai' ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'btn-primary'}`}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('forms.creating','Creating…')}</> : mode==='ai' ? <><Sparkles className="w-4 h-4" /> {t('forms.create_form','Create Form')}</> : t('forms.create_and_build','Create & Build')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FormsPage() {
  const { t } = useTranslation()
  const [forms, setForms]           = useState<FormOut[]>([])
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [qrForm, setQrForm]         = useState<FormOut | null>(null)
  const [versionsForm, setVersionsForm] = useState<FormOut | null>(null)
  const [copiedId, setCopiedId]     = useState<number | null>(null)
  const [sortBy, setSortBy]         = useState<'recent'|'name'|'status'|'fields'>('recent')
  const [filterStatus, setFilterStatus] = useState<'all'|'published'|'draft'|'archived'>('all')
  const navigate = useNavigate()
  const load = () => {
    setLoading(true)
    formsApi.list().then(setForms).catch(() => toast.error(t('forms.load_failed','Failed to load forms'))).finally(() => setLoading(false))
  }

  useEffect(load, [])
  const handleDelete = async (id: number, title: string) => {
    if (!confirm(t('forms.confirm_delete','Delete "{{title}}"? This cannot be undone.', { title }))) return
    try { await formsApi.delete(id); toast.success(t('forms.deleted','Form deleted')); load() }
    catch { toast.error(t('forms.delete_failed','Failed to delete form')) }
  }

  const handleTogglePublic = async (form: FormOut) => {
    try {
      await formsApi.update(form.id, { is_public: !form.is_public })
      toast.success(t(form.is_public ? 'forms.now_private' : 'forms.now_public', form.is_public ? 'Form is now private' : 'Form is now public'))
      load()
    } catch { toast.error(t('forms.update_visibility_failed','Failed to update visibility')) }
  }

  const handleToggleResponses = async (form: FormOut) => {
    try {
      if (form.accepts_responses) {
        await formsApi.close(form.id)
        toast.success(t('forms.closed_now','Form closed — no longer accepting responses'))
      } else {
        await formsApi.reopen(form.id)
        toast.success(t('forms.reopened_now','Form reopened — now accepting responses again'))
      }
      load()
    } catch { toast.error(t('forms.update_failed','Failed to update form')) }
  }

  const handleCopyLink = (form: FormOut) => {
    const link = `${window.location.origin}/public/${form.uuid}`
    navigator.clipboard.writeText(link)
    setCopiedId(form.id)
    toast.success(t('forms.link_copied','Link copied!'))
    setTimeout(() => setCopiedId(null), 2000)
  }

  const currentVersion = (form: FormOut) => form.versions.find(v => v.id === form.current_version_id)
  const latestVersion  = (form: FormOut) => form.versions.slice(-1)[0]

  const displayForms = [...forms]
    .filter(f => filterStatus === 'all' || f.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'name')
  return a.title.localeCompare(b.title)
      if (sortBy === 'status')
  return a.status.localeCompare(b.status)
      if (sortBy === 'fields')
  return (currentVersion(b)?.fields.length ?? 0) - (currentVersion(a)?.fields.length ?? 0)
      // 'recent' — by updated_at desc
      return parseUTC(b.updated_at).getTime() - parseUTC(a.updated_at).getTime()
    })
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('forms.title','My Forms')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{formatNumber(displayForms.length, i18n.language)} {displayForms.length !== 1 ? t('forms.plural','forms') : t('forms.singular','form')}{filterStatus !== 'all' ? ` · ${t(`status.${filterStatus}`, { defaultValue: filterStatus })}` : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter by status */}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400">
            <option value="all">{t('forms.filter_all','All statuses')}</option>
            <option value="published">{t('forms.published','Published')}</option>
            <option value="draft">{t('forms.draft','Draft')}</option>
            <option value="archived">{t('forms.archived','Archived')}</option>
          </select>
          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400">
            <option value="recent">{t('forms.sort_recent','Recently updated')}</option>
            <option value="name">{t('forms.sort_name','Name A–Z')}</option>
            <option value="status">{t('forms.sort_status','By status')}</option>
            <option value="fields">{t('forms.sort_fields','Most fields')}</option>
          </select>
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> {t('forms.new_form','New Form')}
          </button>
        </div>
      </div>

      {/* Create modal */}
      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreate={id => { setCreating(false); navigate(`/forms/${id}/builder`) }}
        />
      )}

      {/* QR modal */}
      {qrForm && (
        <QrModal
          url={`${window.location.origin}/public/${qrForm.uuid}`}
          title={qrForm.title}
          onClose={() => setQrForm(null)}
        />
      )}

      {/* Version history panel */}
      {versionsForm && (
        <VersionPanel form={versionsForm} onClose={() => setVersionsForm(null)} />
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-24 text-gray-400">{t('common.loading','Loading…')}</div>
      ) : forms.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium mb-2">{t('forms.no_forms_yet','No forms yet')}</p>
          <p className="text-gray-400 text-sm mb-6">{t('forms.create_first','Create your first form to get started')}</p>
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> {t('forms.create_first_cta','Create your first form')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {displayForms.map(form => {
            const cv = currentVersion(form)
  const lv = latestVersion(form)
  const pubLink = `${window.location.origin}/public/${form.uuid}`
return (
              <div key={form.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col">
                {/* Card header */}
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate text-base">{form.title}</h3>
                      {form.description && (
                        <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">{form.description}</p>
                      )}
                    </div>
                    <StatusBadge status={form.status} acceptsResponses={form.accepts_responses} />
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400 mb-3">
                    {/* Visibility badge */}
                    <button
                      onClick={() => handleTogglePublic(form)}
                      title={form.is_public ? t('forms.click_to_make_private','Click to make private') : t('forms.click_to_make_public','Click to make public')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                        form.is_public
                          ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
                          : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {form.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {form.is_public ? t('forms.public','Public') : t('forms.private','Private')}
                    </button>

                    {/* Version badge */}
                    {lv && (
                      <button
                        onClick={() => setVersionsForm(form)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                      >
                        <GitBranch className="w-3 h-3" />
                        {t('forms.version_with_number','v{{num}}', { num: lv.version_number })} · {formatNumber(form.versions.length, i18n.language)} {t('forms.version_count', { count: form.versions.length, defaultValue: form.versions.length === 1 ? 'version' : 'versions' })}
                      </button>
                    )}
 
                    <span className="ml-auto">
                      {t('forms.updated','Updated')} {timeAgo(parseUTC(form.updated_at), i18n.language)}
                    </span>
                  </div>

                  {/* Field count */}
                  {cv && (
                    <p className="text-xs text-gray-400">
                      {formatNumber(cv.fields.length, i18n.language)} {t('forms.fields_count', { count: cv.fields.length, defaultValue: cv.fields.length === 1 ? 'field' : 'fields' })} {t('forms.in_current_version','in current version')}
                    </p>
                  )}
                </div>

                {/* Card actions */}
                <div className="px-5 pb-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                  <Link to={`/forms/${form.id}/builder`} className="btn-secondary text-xs py-1.5 flex items-center gap-1">
                    <Pencil className="w-3 h-3" /> {t('forms.edit','Edit')}
                  </Link>
                  <Link to={`/forms/${form.id}/submissions`} className="btn-secondary text-xs py-1.5 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {t('forms.responses','Responses')}
                  </Link>
                  <Link to={`/analytics/${form.id}`} className="btn-secondary text-xs py-1.5 flex items-center gap-1">
                    <BarChart2 className="w-3 h-3" /> {t('forms.stats','Stats')}
                  </Link>

                  <button
                    onClick={() => handleCopyLink(form)}
                    title={t('forms.copy_public_link_title','Copy public link')}
                    className="btn-secondary text-xs py-1.5 flex items-center gap-1"
                  >
                    {copiedId === form.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    {copiedId === form.id ? t('forms.copied','Copied!') : t('forms.copy_link','Copy Link')}
                  </button>
                  <button
                    onClick={() => setQrForm(form)}
                    title={t('forms.show_qr_title','Show QR code')}
                    className="btn-secondary text-xs py-1.5 flex items-center gap-1"
                  >
                    <QrCode className="w-3 h-3" /> {t('forms.qr','QR')}
                  </button>
                  <a href={pubLink} target="_blank" rel="noreferrer"
                    className="btn-secondary text-xs py-1.5 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> {t('forms.preview','Preview')}
                  </a>

                  {/* Close / Reopen — only for published forms */}
                  {form.status === 'published' && (
                    <button
                      onClick={() => handleToggleResponses(form)}
                      title={form.accepts_responses ? t('forms.stop_accepting','Stop accepting responses') : t('forms.reopen_for_responses','Re-open for responses')}
                      className={`btn-secondary text-xs py-1.5 flex items-center gap-1 ${
                        !form.accepts_responses ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-red-500 border-red-200 bg-red-50'
                      }`}
                    >
                      {form.accepts_responses
                        ? <><StopCircle className="w-3 h-3" /> {t('forms.close','Close')}</>
                        : <><RefreshCw className="w-3 h-3" /> {t('forms.reopen','Reopen')}</>}
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(form.id, form.title)}
                    className="ml-auto btn-ghost text-xs py-1.5 text-red-500 hover:bg-red-50 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}