import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { publicApi, draftsApi, translationsApi, stepsApi } from '../lib/apiModules'
import type { FormOutPublic, FormFieldOut, ConditionalRuleOut, TranslationContent, FormStepOut } from '../lib/types'
import { RTL_LANGUAGES } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Send, CheckCircle, Lock, Save, ChevronRight, AlertCircle, Globe, ChevronDown, StopCircle, CalendarClock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { formatNumber, formatDateLocal } from '../lib/localeUtils'
import { differenceInSeconds } from 'date-fns'

type AnswerMap = Record<number, string>

// ── Transliteration via Google Input Tools (free, no key) ────────────────────
// Maps language codes to Google's input method codes
const TRANSLIT_LANGS: Record<string, string> = {
  hi: 'hi', ta: 'ta', te: 'te', mr: 'mr', bn: 'bn',
  gu: 'gu', kn: 'kn', ml: 'ml', pa: 'pa', ur: 'ur',
}

async function transliterate(word: string, lang: string): Promise<string> {
  const code = TRANSLIT_LANGS[lang]
  if (!code || !word.trim())
  return word
  try {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=${code}-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8`
const res = await fetch(url)
  const data = await res.json()
    if (data?.[0] === 'SUCCESS' && data?.[1]?.[0]?.[1]?.[0]) {
      return data[1][0][1][0]
    }
  } catch { /* fall back to original */ }
  return word
}

// ── Language Switcher ─────────────────────────────────────────────────────────
function LanguageSwitcher({ current, available, onChange }: {
  current: string
  available: { code: string; name: string }[]
  onChange: (code: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const currentName = available.find(l => l.code === current)?.name ?? current.toUpperCase()
  if (available.length <= 1)
  return null
  return (
    <div className="relative">
      <button aria-label={t('public.language_button','Language')} onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:border-primary-300 text-sm text-gray-700 transition-colors shadow-sm">
        <Globe className="w-3.5 h-3.5 text-gray-400" />
        {currentName}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
          {available.map(l => (
            <button key={l.code} onClick={() => { onChange(l.code); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                l.code === current ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}>
              <span>{l.name}</span>
              <span className="text-xs text-gray-400">{l.code.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Conditional rules evaluator ───────────────────────────────────────────────
function evaluateRules(rules: ConditionalRuleOut[], answers: AnswerMap): Set<number> {
  const hidden = new Set<number>()
  for (const rule of rules) {
    const triggerVal = answers[rule.trigger_field_id] ?? ''
let condMet = false
    switch (rule.operator) {
      case 'equals':       condMet = triggerVal === rule.trigger_value; break
      case 'not_equals':   condMet = triggerVal !== rule.trigger_value; break
      case 'contains':     condMet = triggerVal.toLowerCase().includes(rule.trigger_value.toLowerCase()); break
      case 'not_empty':    condMet = triggerVal.trim().length > 0; break
      case 'greater_than': condMet = Number(triggerVal) > Number(rule.trigger_value); break
      case 'less_than':    condMet = Number(triggerVal) < Number(rule.trigger_value); break
    }
    if (condMet && rule.action === 'hide') hidden.add(rule.target_field_id)
    if (!condMet && rule.action === 'show') hidden.add(rule.target_field_id)
  }
  return hidden
}

// ── Signature drawing canvas ──────────────────────────────────────────────────
function SignatureField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const clear = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && canvasRef.current) { ctx.clearRect(0,0,canvasRef.current.width,canvasRef.current.height); onChange('') }
  }
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect()
  return { x:(e.clientX-r.left)*(canvasRef.current!.width/r.width), y:(e.clientY-r.top)*(canvasRef.current!.height/r.height) }
  }
  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white" style={{touchAction:'none'}}>
        <canvas ref={canvasRef} width={560} height={120} className="w-full cursor-crosshair" style={{height:'120px'}}
          onPointerDown={e => { isDrawing.current=true; const ctx=canvasRef.current?.getContext('2d'); if(!ctx) return; const p=getPos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y) }}
          onPointerMove={e => { if(!isDrawing.current) return; const ctx=canvasRef.current?.getContext('2d'); if(!ctx) return; const p=getPos(e); ctx.lineWidth=2; ctx.strokeStyle='#1a1a1a'; ctx.lineCap='round'; ctx.lineTo(p.x,p.y); ctx.stroke() }}
          onPointerUp={() => { isDrawing.current=false; onChange(canvasRef.current?.toDataURL('image/png')||'') }}
          onPointerLeave={() => { isDrawing.current=false }} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{t('public.draw_signature','Draw your signature using mouse or touch')}</p>
        <button type="button" onClick={clear} className="text-xs text-red-500 hover:text-red-700">{t('public.clear','Clear')}</button>
      </div>
      {value && <p className="text-xs text-emerald-600">{t('public.signature_captured','✓ Signature captured')}</p>}
    </div>
  )
}

// ── Field renderer ────────────────────────────────────────────────────────────
// NOTE: originalOptions = original English options (for storing answer values)
//       displayOptions  = translated options (for display only)
// We ALWAYS store answers using original values so they are language-independent.
// The `lang` and `dir` attributes are set on inputs so the browser uses the
// correct font rendering, keyboard suggestions and spell-check for the language.
function FieldInput({ field, value, onChange, displayOptions, translatedLabel, translatedPlaceholder, lang, dir }: {
  field: FormFieldOut
  value: string
  onChange: (v: string) => void
  displayOptions: string[]
  translatedLabel: string
  translatedPlaceholder: string
  lang: string
  dir: 'ltr' | 'rtl'
}) {
const { t } = useTranslation()
const originalOpts = Array.isArray(field.options) ? (field.options as string[]) : []
const scaleOpts = field.options as { min?: number; max?: number } | null
const inputClass = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm transition-all bg-white"
const inputAttrs = { lang, dir, spellCheck: true as const }

  // Transliteration: convert last word when Space is pressed (text fields only)
  const supportsTranslit = TRANSLIT_LANGS[lang] && ['text','textarea','number'].includes(field.field_type)
  const handleKeyUp = async (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!supportsTranslit) return
    if (e.key !== ' ') return
    const words = value.split(' ')
  const lastWord = words[words.length - 2] // word before the space just typed
    if (!lastWord || lastWord.trim() === '') return
    // Only transliterate if it looks like Latin script
    if (!/^[a-zA-Z]+$/.test(lastWord)) return
    const converted = await transliterate(lastWord, lang)
    if (converted !== lastWord) {
      words[words.length - 2] = converted
      onChange(words.join(' '))
    }
  }

  if (field.field_type === 'section') {
    return (
      <div className="pt-4">
        {translatedLabel && <h3 className="text-base font-semibold text-gray-800 mb-1" lang={lang} dir={dir}>{translatedLabel}</h3>}
        <div className="h-px bg-gradient-to-r from-primary-200 via-gray-200 to-transparent" />
      </div>
    )
  }
  if (field.field_type === 'divider')
  return <hr className="border-gray-200" />

  function renderInput() {
    switch (field.field_type) {
      case 'textarea':
        return <textarea {...inputAttrs} className={`${inputClass} h-24 resize-y`} placeholder={translatedPlaceholder} value={value} onChange={e => onChange(e.target.value)} onKeyUp={handleKeyUp as React.KeyboardEventHandler<HTMLTextAreaElement>} required={field.is_required} />

      case 'select':
        return (
          <select className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} lang={lang}>
            <option value="">{t('public.select_option','Select an option…')}</option>
            {originalOpts.map((orig, i) => (
              <option key={orig} value={orig}>{displayOptions[i] ?? orig}</option>
            ))}
          </select>
        )

      case 'radio':
        return (
          <div className="space-y-2 mt-1">
            {originalOpts.map((orig, i) => (
              <label key={orig} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${value === orig ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${value === orig ? 'border-primary-500 bg-primary-500' : 'border-gray-300'}`}>
                  {value === orig && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className="text-sm" lang={lang} dir={dir}>{displayOptions[i] ?? orig}</span>
                <input type="radio" name={`field_${field.id}`} value={orig} checked={value === orig} onChange={() => onChange(orig)} className="sr-only" required={field.is_required} />
              </label>
            ))}
          </div>
        )

      case 'checkbox': {
        const selected = value ? value.split(',').filter(Boolean) : []
        return (
          <div className="space-y-2 mt-1">
            {originalOpts.map((orig, i) => {
              const checked = selected.includes(orig)
  return (
                <label key={orig} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'border-primary-500 bg-primary-500' : 'border-gray-300'}`}>
                    {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className="text-sm" lang={lang} dir={dir}>{displayOptions[i] ?? orig}</span>
                  <input type="checkbox" className="sr-only" checked={checked}
                    onChange={e => {
                      if (e.target.checked) onChange([...selected, orig].join(','))
                      else onChange(selected.filter(v => v !== orig).join(','))
                    }} />
                </label>
              )
            })}
          </div>
        )
      }

      case 'toggle':
        return (
          <button type="button" onClick={() => onChange(value === 'true' ? 'false' : 'true')}
            className={`relative inline-flex h-8 w-14 rounded-full border-2 border-transparent transition-colors focus:outline-none ${value === 'true' ? 'bg-primary-500' : 'bg-gray-300'}`}>
            <span className={`inline-block h-7 w-7 transform rounded-full bg-white shadow transition duration-200 ${value === 'true' ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        )

      case 'rating':
        return (
          <div className="flex gap-2 mt-1">
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" onClick={() => onChange(String(n))}
                className={`w-11 h-11 rounded-xl border-2 font-semibold text-base transition-all ${
                  Number(value) >= n ? 'bg-amber-400 border-amber-400 text-white shadow-sm scale-105' : 'border-gray-200 text-gray-400 hover:border-amber-300'
                }`}>★</button>
            ))}
          </div>
        )

      case 'scale': {
        const min = scaleOpts?.min ?? 1
        const max = scaleOpts?.max ?? 10
        const steps = Array.from({ length: max - min + 1 }, (_, i) => i + min)
  return (
          <div className="space-y-2">
            <div className="flex gap-1 flex-wrap">
              {steps.map(n => (
                <button key={n} type="button" onClick={() => onChange(String(n))}
                  className={`w-9 h-9 rounded-lg border-2 text-sm font-medium transition-all ${Number(value) === n ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>{n}</button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400"><span>{t('public.scale_low','{{min}} — low', { min })}</span><span>{t('public.scale_high','{{max}} — high', { max })}</span></div>
          </div>
        )
      }

      case 'date':      return <input type="date" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />
      case 'time':      return <input type="time" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />
      case 'datetime':  return <input type="datetime-local" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />
      case 'number':    return <input type="number" {...inputAttrs} className={inputClass} placeholder={translatedPlaceholder} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />
      case 'email':     return <input type="email" {...inputAttrs} className={inputClass} placeholder={translatedPlaceholder || t('public.placeholder_email','you@example.com')} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />
      case 'tel':       return <input type="tel" {...inputAttrs} className={inputClass} placeholder={translatedPlaceholder || t('public.placeholder_phone','+1 (555) 000-0000')} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />
      case 'url':       return <input type="url" {...inputAttrs} className={inputClass} placeholder={translatedPlaceholder || t('public.placeholder_url','https://')} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />
      case 'password':  return <input type="password" {...inputAttrs} className={inputClass} placeholder={translatedPlaceholder} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />
      case 'color':
        return (
          <div className="flex items-center gap-3">
            <input type="color" className="w-12 h-10 rounded-xl border border-gray-200 cursor-pointer p-1"
              value={value || '#3b82f6'} onChange={e => onChange(e.target.value)} />
            <span className="text-sm font-mono text-gray-600">{value || '#3b82f6'}</span>
          </div>
        )
      case 'phone_cc': {
        const COUNTRY_CODES = [
          {code:'+1',flag:'🇺🇸',name:'US'},{code:'+44',flag:'🇬🇧',name:'UK'},{code:'+91',flag:'🇮🇳',name:'IN'},
          {code:'+86',flag:'🇨🇳',name:'CN'},{code:'+49',flag:'🇩🇪',name:'DE'},{code:'+33',flag:'🇫🇷',name:'FR'},
          {code:'+7',flag:'🇷🇺',name:'RU'},{code:'+81',flag:'🇯🇵',name:'JP'},{code:'+82',flag:'🇰🇷',name:'KR'},
          {code:'+55',flag:'🇧🇷',name:'BR'},{code:'+61',flag:'🇦🇺',name:'AU'},{code:'+971',flag:'🇦🇪',name:'AE'},
          {code:'+92',flag:'🇵🇰',name:'PK'},{code:'+880',flag:'🇧🇩',name:'BD'},{code:'+234',flag:'🇳🇬',name:'NG'},
        ]
        const parts = value ? value.split('|') : ['', '']
        const cc = parts[0] || '+91'
const num = parts[1] || ''
return (
          <div className="flex gap-2">
            <select className="input w-28 shrink-0" value={cc} onChange={e => onChange(`${e.target.value}|${num}`)}>
              {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <input type="tel" {...inputAttrs} className={`${inputClass} flex-1`}
              placeholder={translatedPlaceholder || t('public.placeholder_phone_number','9876543210')} value={num}
              onChange={e => onChange(`${cc}|${e.target.value}`)} required={field.is_required} />
          </div>
        )
      }
      case 'address':
        return (
          <div className="space-y-2" {...inputAttrs}>
            {([
              t('public.address_street','Street / House No.'),
              t('public.address_city','City'),
              t('public.address_state','State / Province'),
              t('public.address_postal_code','Postal Code'),
              t('public.address_country','Country'),
            ] as const).map((sub, i) => {
              const parts = value ? value.split('\n') : []
              return (
                <input key={sub} type="text" className={inputClass} placeholder={sub}
                  value={parts[i] || ''} onChange={e => {
                    const p = value ? value.split('\n') : ['','','','','']
                    while (p.length < 5) p.push('')
                    p[i] = e.target.value
                    onChange(p.join('\n'))
                  }} />
              )
            })}
          </div>
        )
      case 'signature':
        return <SignatureField value={value} onChange={onChange} />
      default:          return <input type="text" {...inputAttrs} className={inputClass} placeholder={translatedPlaceholder} value={value} onChange={e => onChange(e.target.value)} onKeyUp={handleKeyUp as React.KeyboardEventHandler<HTMLInputElement>} required={field.is_required} />
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700" lang={lang} dir={dir}>
        {translatedLabel}
        {field.is_required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderInput()}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PublicFormPage() {
  const { t } = useTranslation()
  const { uuid } = useParams<{ uuid: string }>()
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [form,         setForm]         = useState<FormOutPublic | null>(null)
  const [answers,      setAnswers]      = useState<AnswerMap>({})
  const [hidden,       setHidden]       = useState<Set<number>>(new Set())
  const [submitted,    setSubmitted]    = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [savingDraft,  setSavingDraft]  = useState(false)
  const [draftId,      setDraftId]      = useState<number | null>(null)
  const [error,        setError]        = useState('')
  const [privateWall,  setPrivateWall]  = useState(false)

  // Language state
  const [langCode,      setLangCode]      = useState('en')
  const [translation,   setTranslation]   = useState<TranslationContent | null>(null)
  const [availableLangs, setAvailableLangs] = useState<{ code: string; name: string }[]>([])

  // Multi-step state
  const [steps,       setSteps]       = useState<FormStepOut[]>([])
  const [currentStep, setCurrentStep] = useState(0) // 0-indexed

  const version = form?.versions?.slice(-1)[0]
  const fields: FormFieldOut[] = version?.fields ?? []
  const rules: ConditionalRuleOut[] = (version as unknown as { conditional_rules?: ConditionalRuleOut[] })?.conditional_rules ?? []

  // Recompute hidden fields whenever answers change
  useEffect(() => {
    setHidden(evaluateRules(rules, answers))
  }, [answers]) // eslint-disable-line

  // Load form + multilingual settings
  useEffect(() => {
    if (!uuid) return
    publicApi.getForm(uuid)
      .then(async f => {
        setForm(f)
  const formId = f.versions[0]?.form_id
        if (formId) {
          // Load steps for multi-step forms
          try {
            const stepsData = await stepsApi.list(formId)
            if (stepsData.length > 0) setSteps(stepsData.sort((a, b) => a.step_order - b.step_order))
          } catch { /* no steps — single page form */ }

          // Try to load language settings (no-auth endpoint)
          try {
            const settings = await translationsApi.getPublicSettings(formId)
            if (settings.multilingual_enabled && settings.languages.length > 1) {
              const langs = settings.languages.map(l => ({ code: l.language_code, name: l.language_name }))
              setAvailableLangs(langs)
              // Pick browser language if available, else form default
              const browserLang = navigator.language.split('-')[0]
              const sessionLang = sessionStorage.getItem(`form_lang_${uuid}`)
  const chosen = sessionLang ??
                (langs.find(l => l.code === browserLang)?.code) ??
                settings.default_language ?? 'en'
              setLangCode(chosen)
              if (chosen !== 'en') {
                try {
                  const t = await translationsApi.getPublic(formId, chosen)
                  setTranslation(t.content)
                } catch { /* no translation yet */ }
              }
            }
          } catch { /* multilingual not set up */ }

          // Load saved draft
          if (user) {
            try {
              const draft = await draftsApi.getByForm(formId)
              if (draft) {
                setDraftId(draft.id)
  const map: AnswerMap = {}
                for (const a of draft.answers) {
                  if (a.form_field_id != null) map[a.form_field_id] = String(a.answer_value ?? '')
                }
                setAnswers(map)
              }
            } catch { /* no draft */ }
          }
        }
      })
      .catch(err => {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 401) setPrivateWall(true)
        else setError(t('public.form_not_found','Form not found or not currently available.'))
      })
  }, [uuid, user])

  // Switch language — persist choice in session, load translation content
  const handleLangChange = async (code: string) => {
    setLangCode(code)
    sessionStorage.setItem(`form_lang_${uuid}`, code)
    if (code === 'en') { setTranslation(null); return }
    const formId = form?.versions[0]?.form_id
    if (!formId) return
    try {
      const t = await translationsApi.getPublic(formId, code)
      setTranslation(t.content)
    } catch { setTranslation(null) }
  }

  // Get translated display values for a field (label, placeholder, options)
  // IMPORTANT: answers are always stored in the ORIGINAL language value so they
  // are language-independent and readable by admin in any language.
  // We look up by field_name (stable across republishes), falling back to field.id for old data.
  const getFieldTranslation = (field: FormFieldOut) => {
    const fieldMap = translation?.fields
    // Try field_name first (new stable key), then str(field.id) for backwards compat
    const ft = fieldMap
      ? (fieldMap[field.field_name] ?? fieldMap[String(field.id)] ?? null)
      : null
    const originalOpts = Array.isArray(field.options) ? (field.options as string[]) : []
    const displayOptions: string[] = ft?.options?.length
      ? (ft.options as string[])
      : originalOpts
    return {
      label:       (ft?.label?.trim())       || field.label,
      placeholder: (ft?.placeholder?.trim()) || field.placeholder || '',
      displayOptions,
    }
  }

  const setAnswer = (fieldId: number, value: string) =>
    setAnswers(prev => ({ ...prev, [fieldId]: value }))
  const handleSaveDraft = async () => {
    if (!user || !form) return
    const formId = form.versions[0]?.form_id
    if (!formId) return
    setSavingDraft(true)
  const payload = fields.map(f => ({ form_field_id: f.id, answer_value: answers[f.id] ?? null, answer_json: null }))
    try {
      if (draftId) await draftsApi.update(draftId, payload)
      else { const d = await draftsApi.save(formId, payload); setDraftId(d.id) }
      toast.success(t('public.draft_saved','Draft saved'))
    } catch { toast.error(t('public.draft_save_failed','Could not save draft')) }    finally { setSavingDraft(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uuid) return
    for (const f of fields.filter(f => !hidden.has(f.id))) {
      if (f.is_required && !answers[f.id]?.trim()) {
        toast.error(t('public.field_required','"{{label}}" is required', { label: f.label }))
        return
      }
    }
    setSubmitting(true)
    try {
      const payload = fields.map(f => ({ form_field_id: f.id, answer_value: answers[f.id] ?? null }))
      await publicApi.submit(uuid, payload)
      setSubmitted(true)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if ((e as { response?: { status?: number } })?.response?.status === 401) setPrivateWall(true)
      else toast.error(msg || t('public.submission_failed','Submission failed. Please try again.'))
    } finally { setSubmitting(false) }
  }

  const upcomingStart = form?.scheduled_start_at ? new Date(form.scheduled_start_at) : null

  function UpcomingCountdown({ targetDate }: { targetDate: Date }) {
    const [now, setNow] = useState(new Date())
    useEffect(() => {
      const id = setInterval(() => setNow(new Date()), 1000)
      return () => clearInterval(id)
    }, [])

    const seconds = Math.max(0, differenceInSeconds(targetDate, now))
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    const parts: string[] = []
    if (days > 0) parts.push(`${formatNumber(days, i18n.language)} ${t('public.days', 'days')}`)
    if (hours > 0 || days > 0) parts.push(`${formatNumber(hours, i18n.language)} ${t('public.hours', 'hours')}`)
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${formatNumber(minutes, i18n.language)} ${t('public.minutes', 'minutes')}`)
    parts.push(`${formatNumber(secs, i18n.language)} ${t('public.seconds', 'seconds')}`)
    return <span className="font-mono tabular-nums text-lg font-semibold text-amber-700">{parts.join(', ')}</span>
  }

  // ── Upcoming form page ───────────────────────────────────────────────────────
  if (form?.is_upcoming && upcomingStart) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg w-full border border-amber-100">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CalendarClock className="w-8 h-8 text-amber-600" />
          </div>
          <p className="text-center text-xs uppercase tracking-[0.2em] text-amber-600 font-semibold mb-2">
            {t('public.upcoming_form', 'Upcoming Form')}
          </p>
          <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">{form.title}</h1>
          <p className="text-center text-gray-600 text-sm mb-6">
            {t('public.upcoming_desc', 'This form will open on {{date}} at {{time}}.', {
              date: formatDateLocal(upcomingStart, i18n.language, { dateStyle: 'full' }),
              time: formatDateLocal(upcomingStart, i18n.language, { timeStyle: 'short' }),
            })}
          </p>
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 text-center">
            <p className="text-xs uppercase tracking-[0.12em] text-amber-700 font-semibold mb-3">
              {t('public.opens_in', 'Opens in')}
            </p>
            <UpcomingCountdown targetDate={upcomingStart} />
          </div>
          <div className="mt-6 flex flex-col gap-2">
            {user ? (
              <button onClick={() => navigate('/browse')} className="btn-secondary w-full justify-center">
                {t('public.browse_other_forms', 'Browse Other Forms')}
              </button>
            ) : (
              <>
                <Link to={`/login?redirect=/public/${uuid}`} className="btn-primary w-full justify-center">
                  {t('auth.signIn', 'Sign In')} <ChevronRight className="w-4 h-4" />
                </Link>
                <Link to="/register" className="btn-secondary w-full justify-center text-sm">
                  {t('auth.createAccount', 'Create Account')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Private wall ──────────────────────────────────────────────────────────
  if (privateWall)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('public.private_form_title','Unauthorized Access')}</h2>
        <p className="text-gray-500 text-sm mb-6">{t('public.private_form_desc','This is a private form and is available only to registered users. Please register or log in to access this form.')}</p>
        <Link to={`/login?redirect=/public/${uuid}`} className="btn-primary w-full justify-center">
          {t('auth.signIn','Sign In')} <ChevronRight className="w-4 h-4" />
        </Link>
        <Link to="/register" className="btn-secondary w-full justify-center mt-2 text-sm">{t('auth.createAccount','Create Account')}</Link>
      </div>
    </div>
  )

  if (error)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-xl font-bold text-gray-700 mb-2">{t('public.unavailable_title','Form Unavailable')}</p>
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    </div>
  )

  if (!form)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex items-center gap-3 text-gray-400">
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-primary-500 animate-spin" />
        {t('common.loading','Loading…')}
      </div>
    </div>
  )

  // ── Form closed (no longer accepting responses) ───────────────────────────
  if (form && form.accepts_responses === false)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <StopCircle className="w-8 h-8 text-orange-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('public.closed_title','Form Closed')}</h2>
        <p className="text-gray-500 text-sm mb-2">
          <strong>{form.title}</strong>
        </p>
        <p className="text-gray-400 text-sm">
          {t('public.closed_desc','This form is no longer accepting new responses. Thank you for your interest.')}
        </p>
      </div>
    </div>
  )

  if (submitted)
  return (    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-sm w-full text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('public.thank_you','Thank you!')}</h1>
        <p className="text-gray-500 mb-6">{translation?.thank_you_message || t('public.thank_you_default','Your response has been submitted successfully.')}</p>
        {user && (
          <button onClick={() => navigate('/browse')} className="btn-secondary w-full justify-center">
            {t('public.browse_more','Browse More Forms')}
          </button>
        )}
      </div>
    </div>
  )
  const visibleFields = fields.filter(f => !hidden.has(f.id) && f.field_type !== 'section' && f.field_type !== 'divider')
  const answered  = visibleFields.filter(f => answers[f.id]?.trim()).length
  const isRTL     = RTL_LANGUAGES.has(langCode)
  const submitBtn = translation?.submit_button || t('buttons.submit','Submit')

  // Multi-step logic
  const isMultiStep = steps.length > 1
  const stepFields = isMultiStep
    ? fields.filter(f => f.step_id === steps[currentStep]?.id)
    : fields
  const stepVisibleFields = stepFields.filter(f => !hidden.has(f.id) && f.field_type !== 'section' && f.field_type !== 'divider')
  const stepAnswered = stepVisibleFields.filter(f => answers[f.id]?.trim()).length
  const totalProgress = isMultiStep
    ? Math.round(((currentStep + (stepAnswered / Math.max(stepVisibleFields.length, 1))) / steps.length) * 100)
    : visibleFields.length > 0 ? Math.round((answered / visibleFields.length) * 100) : 0
  const displayFields = isMultiStep ? stepFields : fields

  const handleNextStep = () => {
    // Validate required fields in current step
    for (const f of stepVisibleFields) {
      if (f.is_required && !answers[f.id]?.trim()) {
        toast.error(t('public.field_required','"{{label}}" is required', { label: f.label }))
        return
      }
    }
    setCurrentStep(s => Math.min(s + 1, steps.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePrevStep = () => {
    setCurrentStep(s => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isLastStep = !isMultiStep || currentStep === steps.length - 1

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 py-10 px-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{t('public.live_form','Live Form')}</span>
              {form.is_public === false && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />{t('public.private','Private')}
                </span>
              )}
            </div>
            <LanguageSwitcher current={langCode} available={availableLangs} onChange={handleLangChange} />
          </div>
          {/* Multi-step indicator */}
          {isMultiStep && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < currentStep ? 'bg-emerald-500 text-white' :
                    i === currentStep ? 'bg-primary-600 text-white ring-2 ring-primary-200' :
                    'bg-gray-200 text-gray-500'
                  }`}>{i < currentStep ? '✓' : i + 1}</div>
                  {i < steps.length - 1 && (
                    <div className={`h-0.5 w-6 transition-all ${i < currentStep ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
              <span className="text-xs text-gray-400 ml-2">
                {t('public.step_of','Step {{current}} of {{total}}', { current: formatNumber(currentStep + 1, i18n.language), total: formatNumber(steps.length, i18n.language) })}: <strong>{steps[currentStep]?.title}</strong>
              </span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{translation?.title || form.title}</h1>
          {(translation?.description || form.description) && (
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">{translation?.description || form.description}</p>
          )}
          {visibleFields.length > 0 && (
            <div className="mt-5">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>{isMultiStep ? t('public.step_of','Step {{current}} of {{total}}', { current: formatNumber(currentStep + 1, i18n.language), total: formatNumber(steps.length, i18n.language) }) : t('public.answered_of','{{answered}} of {{total}} answered', { answered: formatNumber(answered, i18n.language), total: formatNumber(visibleFields.length, i18n.language) })}</span>
                <span>{formatNumber(totalProgress, i18n.language)}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${totalProgress}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Honeypot anti-spam — hidden from users, visible to bots */}
            <input
              type="text"
              name="_honey"
              style={{ display: 'none' }}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />
            {displayFields.filter(f => !hidden.has(f.id)).map(field => {
              const { label, placeholder, displayOptions } = getFieldTranslation(field)
  return (
                <FieldInput
                  key={field.id}
                  field={field}
                  value={answers[field.id] ?? ''}
                  onChange={v => setAnswer(field.id, v)}
                  displayOptions={displayOptions}
                  translatedLabel={label}
                  translatedPlaceholder={placeholder}
                  lang={langCode}
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              )
            })}

            {displayFields.length === 0 && (
              <p className="text-center text-gray-400 py-8">
                {isMultiStep ? t('public.no_fields_step','No fields assigned to this step yet.') : t('public.no_fields_form','This form has no fields yet.')}
              </p>
            )}

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              {/* Back button for multi-step */}
              {isMultiStep && currentStep > 0 && (
                <button type="button" onClick={handlePrevStep}
                  className="btn-secondary flex items-center gap-2 text-sm">
                  {t('public.prev','← Back')}
                </button>
              )}
              {user && isLastStep && (
                <button type="button" onClick={handleSaveDraft} disabled={savingDraft}
                  className="btn-secondary flex-1 justify-center text-sm">
                  <Save className="w-4 h-4" />
                  {savingDraft ? t('common.saving','Saving…') : draftId ? t('public.update_draft','Update Draft') : t('public.save_draft','Save Draft')}
                </button>
              )}
              {isLastStep ? (
                <button type="submit" disabled={submitting}
                  className="btn-primary flex-1 justify-center text-sm">
                  <Send className="w-4 h-4" />
                  {submitting ? t('common.submitting','Submitting…') : submitBtn}
                </button>
              ) : (
                <button type="button" onClick={handleNextStep}
                  className="btn-primary flex-1 justify-center text-sm">
                  {t('public.next_step','Next Step →')}
                </button>
              )}
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-gray-300 pb-4">{t('public.powered_by','Powered by Enterprise Form Builder')}</p>
      </div>
    </div>
  )
}