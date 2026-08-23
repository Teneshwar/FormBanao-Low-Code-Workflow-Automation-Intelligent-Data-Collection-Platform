import { useEffect, useState, useCallback } from 'react'
import * as React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import i18n from '../i18n'
import { formatNumber } from '../lib/localeUtils'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ResponsiveGridLayout as GridLayout, type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { formsApi, fieldsApi, rulesApi } from '../lib/apiModules'
import type { FormOut, FormFieldOut, ConditionalRuleOut, LayoutConfig } from '../lib/types'
import LanguagesTab from '../components/LanguagesTab'
import StepsManager from '../components/StepsManager'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, GripVertical, Save, Globe, ChevronLeft, Settings, Copy,
  Type, Hash, AlignLeft, Mail, Phone, Link2, Lock, Calendar, Clock, Star,
  List, CheckSquare, CircleDot, FileUp, ToggleLeft, Minus, ChevronDown,
  Eye, GitBranch, Globe2, AlertCircle, ArrowRight, Edit3, X, Zap,
  Pen, Palette, MapPin, Smartphone, StopCircle, RefreshCw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

// ── Field type catalogue ──────────────────────────────────────────────────────
interface FieldTypeDef {
  value: string; label: string; description: string
  icon: React.ReactNode; category: string
  hasOptions?: boolean; hasPlaceholder?: boolean
  defaultW?: number; defaultH?: number
}

const FIELD_CATALOGUE: FieldTypeDef[] = [
  { value:'text',      label:'Short Text',           description:'Single line text',            icon:<Type className="w-4 h-4"/>,         category:'Text',        hasPlaceholder:true,  defaultW:6,  defaultH:2 },
  { value:'textarea',  label:'Long Text',             description:'Multi-line paragraph',        icon:<AlignLeft className="w-4 h-4"/>,    category:'Text',        hasPlaceholder:true,  defaultW:12, defaultH:3 },
  { value:'number',    label:'Number',                description:'Integer or decimal',          icon:<Hash className="w-4 h-4"/>,         category:'Text',        hasPlaceholder:true,  defaultW:4,  defaultH:2 },
  { value:'email',     label:'Email Address',         description:'Valid email input',           icon:<Mail className="w-4 h-4"/>,         category:'Text',        hasPlaceholder:true,  defaultW:6,  defaultH:2 },
  { value:'tel',       label:'Phone Number',          description:'Mobile / landline',           icon:<Phone className="w-4 h-4"/>,        category:'Text',        hasPlaceholder:true,  defaultW:6,  defaultH:2 },
  { value:'phone_cc',  label:'Phone + Country Code',  description:'Phone with country selector', icon:<Smartphone className="w-4 h-4"/>,   category:'Text',        hasPlaceholder:true,  defaultW:6,  defaultH:2 },
  { value:'url',       label:'Website URL',           description:'https://... link',            icon:<Link2 className="w-4 h-4"/>,        category:'Text',        hasPlaceholder:true,  defaultW:6,  defaultH:2 },
  { value:'password',  label:'Password',              description:'Masked text input',           icon:<Lock className="w-4 h-4"/>,         category:'Text',        hasPlaceholder:true,  defaultW:6,  defaultH:2 },
  { value:'address',   label:'Address',               description:'Full address (multiline)',    icon:<MapPin className="w-4 h-4"/>,       category:'Text',        hasPlaceholder:true,  defaultW:12, defaultH:4 },
  { value:'select',    label:'Dropdown',              description:'Pick one from a list',        icon:<ChevronDown className="w-4 h-4"/>,  category:'Choice',      hasOptions:true,      defaultW:6,  defaultH:2 },
  { value:'radio',     label:'Multiple Choice',       description:'Pick exactly one option',     icon:<CircleDot className="w-4 h-4"/>,    category:'Choice',      hasOptions:true,      defaultW:6,  defaultH:3 },
  { value:'checkbox',  label:'Checkboxes',            description:'Pick one or more options',    icon:<CheckSquare className="w-4 h-4"/>,  category:'Choice',      hasOptions:true,      defaultW:6,  defaultH:3 },
  { value:'toggle',    label:'Yes / No Toggle',       description:'On/off boolean switch',       icon:<ToggleLeft className="w-4 h-4"/>,   category:'Choice',                            defaultW:4,  defaultH:2 },
  { value:'date',      label:'Date',                  description:'Calendar date picker',        icon:<Calendar className="w-4 h-4"/>,     category:'Date & Time',                       defaultW:4,  defaultH:2 },
  { value:'time',      label:'Time',                  description:'Time picker (HH:MM)',          icon:<Clock className="w-4 h-4"/>,        category:'Date & Time',                       defaultW:4,  defaultH:2 },
  { value:'datetime',  label:'Date & Time',           description:'Date + time combined',        icon:<Calendar className="w-4 h-4"/>,     category:'Date & Time',                       defaultW:6,  defaultH:2 },
  { value:'rating',    label:'Star Rating',           description:'1–5 star scale',              icon:<Star className="w-4 h-4"/>,         category:'Rating',                            defaultW:6,  defaultH:2 },
  { value:'scale',     label:'Linear Scale',          description:'Numeric scale (e.g. 1–10)',   icon:<Minus className="w-4 h-4"/>,        category:'Rating',                            defaultW:8,  defaultH:2 },
  { value:'file',      label:'File Upload',           description:'Any file, max 10 MB',         icon:<FileUp className="w-4 h-4"/>,       category:'File',                              defaultW:6,  defaultH:2 },
  { value:'image',     label:'Image Upload',          description:'JPG/PNG/GIF/WebP',            icon:<FileUp className="w-4 h-4"/>,       category:'File',                              defaultW:6,  defaultH:2 },
  { value:'document',  label:'Document Upload',       description:'PDF/Word/Excel/CSV',          icon:<FileUp className="w-4 h-4"/>,       category:'File',                              defaultW:6,  defaultH:2 },
  { value:'signature', label:'Digital Signature',     description:'Draw or type a signature',    icon:<Pen className="w-4 h-4"/>,          category:'Signature',                         defaultW:8,  defaultH:4 },
  { value:'color',     label:'Color Picker',          description:'Choose a color',              icon:<Palette className="w-4 h-4"/>,      category:'Special',                           defaultW:4,  defaultH:2 },
  { value:'section',   label:'Section Header',        description:'Group fields with a title',   icon:<List className="w-4 h-4"/>,         category:'Layout',                            defaultW:12, defaultH:1 },
  { value:'divider',   label:'Divider',               description:'Horizontal separator',        icon:<Minus className="w-4 h-4"/>,        category:'Layout',                            defaultW:12, defaultH:1 },
]

const CATEGORIES = [...new Set(FIELD_CATALOGUE.map(f => f.category))]

function labelToFieldName(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')
}

// ── Field Type Picker modal ───────────────────────────────────────────────────
function FieldTypePicker({ onPick, onClose }: { onPick:(t:string)=>void; onClose:()=>void }) {
  const { t } = useTranslation()
  const [cat, setCat] = useState(CATEGORIES[0])
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl modal-panel">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('forms.choose_field_type','Choose Field Type')}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{t('forms.pick_kind_of_input','Pick the kind of input for this field')}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-1.5 px-5 pt-4 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                cat===c ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{t(`forms.category.${c}`, { defaultValue: c })}</button>
          ))}
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto">
          {FIELD_CATALOGUE.filter(f => f.category===cat).map(ft => (
            <button key={ft.value} onClick={() => onPick(ft.value)}
              className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-primary-400 hover:bg-primary-50 text-left transition-all group">
              <div className="bg-gray-100 group-hover:bg-primary-100 p-2 rounded-lg shrink-0 mt-0.5 text-gray-600 group-hover:text-primary-700 transition-colors">{ft.icon}</div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 leading-tight">{t(`fields.${ft.value}.label`, { defaultValue: ft.label })}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{t(`fields.${ft.value}.description`, { defaultValue: ft.description })}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Field Config Modal ────────────────────────────────────────────────────────
interface FieldModalProps {
  initial?: Partial<FormFieldOut>; fieldType: string
  onSave: (d: Partial<FormFieldOut>) => void; onClose: () => void
}

function FieldModal({ initial, fieldType, onSave, onClose }: FieldModalProps) {
  // typeDef must be declared FIRST before any useState that references it
  const typeDef          = FIELD_CATALOGUE.find(f => f.value === fieldType)
  const { t } = useTranslation()
  const needsOptions     = typeDef?.hasOptions ?? false
  const needsPlaceholder = typeDef?.hasPlaceholder ?? false
  const isLayout         = ['section','divider'].includes(fieldType)
  const [label, setLabel]             = useState(initial?.label || '')
  const [placeholder, setPlaceholder] = useState(initial?.placeholder || '')
  const [isRequired, setIsRequired]   = useState(initial?.is_required ?? false)
  const [optionsText, setOptionsText] = useState(() =>
    Array.isArray(initial?.options) ? (initial.options as string[]).join('\n') : '')
  const [scaleMin, setScaleMin] = useState((initial?.options as {min?:number})?.min ?? 1)
  const [scaleMax, setScaleMax] = useState((initial?.options as {max?:number})?.max ?? 10)
  const [colSpan, setColSpan]   = useState((initial?.layout_config as {w?:number})?.w ?? typeDef?.defaultW ?? 6)
  const handleSave = () => {
    if (!label.trim() && !isLayout) { toast.error(t('fields.label_required','Label is required')); return }
    if (needsOptions && !optionsText.trim()) { toast.error(t('fields.add_option_required','Add at least one option')); return }
    const field_name = labelToFieldName(label) || `field_${Date.now()}`
const opts = needsOptions
      ? optionsText.split('\n').map(s=>s.trim()).filter(Boolean)
      : fieldType==='scale' ? { min:scaleMin, max:scaleMax } : null

    const existingLayout = initial?.layout_config as {x?:number;y?:number;w?:number;h?:number} | null
    const layout_config = {
      x: existingLayout?.x ?? 0,
      y: existingLayout?.y ?? 0,
      w: colSpan,
      h: existingLayout?.h ?? typeDef?.defaultH ?? 2,
    }
    onSave({
      ...(initial?.id ? { id:initial.id, form_version_id:initial.form_version_id } : {}),
      label: label || typeDef?.label || fieldType,
      field_name, field_type: fieldType,
      placeholder: placeholder || null,
      is_required: isRequired,
      order_index: initial?.order_index ?? 0,
      options: opts,
      layout_config,
    })
  }

  // address and signature have fixed structure
  const isSignature = fieldType === 'signature'
const isAddress   = fieldType === 'address'
const isPhoneCC   = fieldType === 'phone_cc'
const isColor     = fieldType === 'color'
return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md my-4 modal-panel">
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-primary-100 p-2 rounded-lg text-primary-700">{typeDef?.icon}</div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">
              {initial?.id ? t('forms.edit','Edit') : t('forms.add','Add')} — {t(`fields.${typeDef?.value ?? fieldType}.label`, { defaultValue: typeDef?.label ?? fieldType })}
            </h2>
            <p className="text-xs text-gray-400">{typeDef?.description}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">{isLayout && fieldType==='section' ? t('forms.section_title','Section Title') : isLayout ? t('forms.label_optional','Label (optional)') : t('forms.question_label','Question / Label *')}</label>
            <input className="input" autoFocus value={label}
              placeholder={isLayout ? (fieldType==='section' ? t('forms.section_example','e.g. Personal Information') : '') : t(`fields.${fieldType}.example`, { defaultValue: `e.g. ${typeDef?.label}` })}
              onChange={e => setLabel(e.target.value)} />
            {label && !isLayout && (
              <p className="text-xs text-gray-400 mt-1">{t('fields.key_label','Key:')} <span className="font-mono">{labelToFieldName(label)}</span></p>
            )}
          </div>

          {needsOptions && (
            <div>
              <label className="label">{t('fields.options_label','Options')} <span className="text-gray-400 font-normal">({t('fields.one_per_line','one per line')})</span></label>
              <textarea className="input h-28 resize-none font-mono text-sm" value={optionsText}
                onChange={e => setOptionsText(e.target.value)} placeholder={t('fields.options_example','Option A\nOption B\nOption C')} />
              <p className="text-xs text-gray-400 mt-1">{formatNumber(optionsText.split('\n').filter(Boolean).length, i18n.language)} {t('fields.options_count_suffix','option(s)')}</p>
            </div>
          )}

          {fieldType==='scale' && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">{t('fields.min_value','Min value')}</label>
                <input type="number" className="input" value={scaleMin} onChange={e=>setScaleMin(Number(e.target.value))} /></div>
              <div><label className="label">{t('fields.max_value','Max value')}</label>
                <input type="number" className="input" value={scaleMax} onChange={e=>setScaleMax(Number(e.target.value))} /></div>
            </div>
          )}

          {needsPlaceholder && (
            <div>
              <label className="label">{t('fields.placeholder_label','Placeholder')} <span className="text-gray-400 font-normal">({t('fields.optional','optional hint')})</span></label>
              <input className="input" value={placeholder} placeholder={t('fields.placeholder_example','e.g. Enter here…')} onChange={e=>setPlaceholder(e.target.value)} />
            </div>
          )}

          {/* New field type info boxes */}
          {isSignature && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-700">
              <p className="font-semibold mb-1">{t('fields.signature_title','✍️ Digital Signature field')}</p>
              <p>{t('fields.signature_desc','Respondents can draw their signature directly in the browser using a touch/mouse canvas. The signature is saved as a base64 image.')}</p>
            </div>
          )}
          {isAddress && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs text-teal-700">
              <p className="font-semibold mb-1">{t('fields.address_title','📍 Address field')}</p>
              <p>{t('fields.address_desc','Shows street, city, state/province, postal code, and country sub-fields in one grouped block.')}</p>
            </div>
          )}
          {isColor && (
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 text-xs text-pink-700">
              <p className="font-semibold mb-1">{t('fields.color_title','🎨 Color Picker field')}</p>
              <p>{t('fields.color_desc','Respondents pick a color using the browser\'s native color picker. The value is stored as a hex code (e.g. #ff5733).')}</p>
            </div>
          )}
          {isPhoneCC && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              <p className="font-semibold mb-1">{t('fields.phonecc_title','📞 Phone + Country Code field')}</p>
              <p>{t('fields.phonecc_desc','Shows a country flag/code dropdown next to the phone number input for international numbers.')}</p>
            </div>
          )}

          {/* Column width control */}
          {!isLayout && (            <div>
              <label className="label">{t('fields.width_on_form','Width on form')}</label>
              <div className="grid grid-cols-4 gap-2">
                {[{label:'¼',val:3},{label:'½',val:6},{label:'¾',val:9},{label:'Full',val:12}].map(opt => (
                  <button key={opt.val} type="button"
                    onClick={() => setColSpan(opt.val)}
                    className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                      colSpan===opt.val ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>{opt.label}</button>
                ))}
              </div>
            </div>
          )}

          {!isLayout && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer select-none"
              onClick={() => setIsRequired(v=>!v)}>
              <div>
                <p className="text-sm font-medium text-gray-800">{t('fields.required_field','Required field')}</p>
                <p className="text-xs text-gray-400">{t('fields.required_field_desc','Respondents must answer this')}</p>
              </div>
              <div className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${isRequired?'bg-primary-600':'bg-gray-300'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${isRequired?'translate-x-5':'translate-x-0'}`} />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button className="btn-secondary" onClick={onClose}>{t('forms.cancel','Cancel')}</button>
          <button className="btn-primary" onClick={handleSave}>
            <Save className="w-4 h-4" />{initial?.id ? t('fields.update_field','Update Field') : t('fields.add_field','Add Field')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sortable field card (list view) ──────────────────────────────────────────
function SortableField({ field, onEdit, onDelete, onDuplicate }: {
  field: FormFieldOut; onEdit:()=>void; onDelete:()=>void; onDuplicate:()=>void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const typeDef = FIELD_CATALOGUE.find(f => f.value === field.field_type)
  const opts = Array.isArray(field.options) ? (field.options as string[]) : []
  const lc = field.layout_config as {w?:number}|null
  const widthLabel = lc?.w === 3 ? '¼' : lc?.w === 6 ? '½' : lc?.w === 9 ? '¾' : lc?.w === 12 ? t('fields.full','Full') : '½'
return (
    <div ref={setNodeRef} style={{ transform:CSS.Transform.toString(transform), transition }}
      className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 group hover:border-primary-200 hover:shadow-sm transition-all ${isDragging?'opacity-50 shadow-xl ring-2 ring-primary-300':''}`}>
      <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical className="w-5 h-5" />
      </button>
      <div className="bg-gray-100 p-1.5 rounded-lg shrink-0 text-gray-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
        {typeDef?.icon ?? <Type className="w-3.5 h-3.5"/>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">{field.label}</span>
          {field.is_required && <span className="text-red-500 text-xs font-bold" title="Required">*</span>}
          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{typeDef?.label ?? field.field_type}</span>
          <span className="text-xs bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded-full">{t('fields.width_prefix','W:')} {widthLabel}</span>
        </div>
        {opts.length > 0 && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{opts.slice(0,3).join(' · ')}{opts.length>3?` +${opts.length-3} more`:''}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onDuplicate} title={t('fields.duplicate','Duplicate')} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Copy className="w-3.5 h-3.5"/></button>
        <button onClick={onEdit} title={t('forms.edit','Edit')} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50"><Settings className="w-3.5 h-3.5"/></button>
        <button onClick={onDelete} title={t('fields.delete','Delete')} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5"/></button>
      </div>
    </div>
  )
}

// ── Drag-Drop Canvas (react-grid-layout) ─────────────────────────────────────
function DragDropCanvas({ fields, onLayoutChange }: {
  fields: FormFieldOut[]
  onLayoutChange: (fieldId: number, layout: LayoutConfig) => void
}) {
  const { t } = useTranslation()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [canvasWidth, setCanvasWidth] = React.useState(800)

  React.useEffect(() => {
    const update = () => {
      if (containerRef.current) setCanvasWidth(containerRef.current.offsetWidth - 32)
    }
    update()
  const observer = new ResizeObserver(update)
    if (containerRef.current) observer.observe(containerRef.current)
  return () => observer.disconnect()
  }, [])
  const layout = fields.map(f => {
    const lc = f.layout_config as { x?:number; y?:number; w?:number; h?:number } | null
    const typeDef = FIELD_CATALOGUE.find(td => td.value === f.field_type)
  return {
      i: String(f.id),
      x: lc?.x ?? 0,
      y: lc?.y ?? 0,
      w: lc?.w ?? typeDef?.defaultW ?? 6,
      h: lc?.h ?? typeDef?.defaultH ?? 2,
      minW: 2, maxW: 12, minH: 1,
    }
  })
  const handleChange = (layout: Layout) => {
    for (const item of layout) {
      const fieldId = Number(item.i)
  const field = fields.find(f => f.id === fieldId)
      if (!field) continue
      const old = field.layout_config as { x?:number; y?:number; w?:number; h?:number } | null
      if (old?.x === item.x && old?.y === item.y && old?.w === item.w && old?.h === item.h) continue
      onLayoutChange(fieldId, { x: item.x, y: item.y, w: item.w, h: item.h })
    }
  }

  if (fields.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center text-gray-400">
        <p>{t('fields.add_fields_prompt','Add fields in the Fields tab, then arrange them here')}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm" ref={containerRef}>
      <div className="flex items-center gap-2 p-4 pb-2 border-b border-gray-100">
        <Eye className="w-4 h-4 text-gray-400" />
        <p className="text-sm font-medium text-gray-600">{t('fields.drag_drop_canvas','Drag-Drop Canvas')}</p>
        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full ml-auto">{t('fields.12_col_grid','12-column grid')}</span>
        <span className="text-xs text-gray-400">{t('fields.drag_instructions','Drag to move · resize from bottom-right corner')}</span>
      </div>
      <div className="p-4 overflow-x-auto">
        <GridLayout
          className="layout"
          layouts={{ lg: layout }}
          cols={{ lg: 12 }}
          breakpoints={{ lg: 1200 }}
          width={canvasWidth}
          onLayoutChange={(layout) => handleChange(layout)}
          rowHeight={50}
          margin={[8, 8]}
          containerPadding={[0, 0]}
          dragConfig={{ enabled: true, bounded: false, handle: '.drag-handle', threshold: 3 }}
        >
          {fields.map(field => {
            const typeDef = FIELD_CATALOGUE.find(td => td.value === field.field_type)
  return (
              <div key={String(field.id)}
                className="bg-white border-2 border-gray-200 hover:border-primary-400 rounded-xl flex flex-col group transition-all shadow-sm hover:shadow-md overflow-hidden select-none">
                {/* Drag handle bar */}
                <div className="drag-handle flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-grab active:cursor-grabbing border-b border-gray-200 group-hover:bg-primary-50 transition-colors">
                  <GripVertical className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-500 shrink-0" />
                  <span className="text-xs font-semibold text-gray-700 truncate flex-1 group-hover:text-primary-700">{field.label}</span>
                  {field.is_required && <span className="text-red-500 text-xs font-bold shrink-0">*</span>}
                </div>
                {/* Field preview */}
                <div className="flex-1 flex items-center px-3 py-2 min-h-0 overflow-hidden">
                  <div className="flex items-center gap-2 text-gray-400 w-full">
                    <span className="shrink-0 text-gray-500">{typeDef?.icon}</span>
                    <span className="text-xs text-gray-500 truncate">{typeDef?.label ?? field.field_type}</span>
                    {field.field_type === 'select' || field.field_type === 'radio' || field.field_type === 'checkbox' ? (
                      <span className="text-xs text-gray-400 ml-auto shrink-0">
                        {formatNumber(Array.isArray(field.options) ? (field.options as string[]).length : 0, i18n.language)} {t('fields.options_short','options')}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </GridLayout>
      </div>
    </div>
  )
}

// ── Improved Conditional Rules UI ─────────────────────────────────────────────
const OPERATORS = [
  { value: 'equals',        label: '= equals' },
  { value: 'not_equals',    label: '≠ does not equal' },
  { value: 'contains',      label: '∋ contains' },
  { value: 'not_empty',     label: '✓ is not empty' },
  { value: 'greater_than',  label: '> greater than' },
  { value: 'less_than',     label: '< less than' },
]

function RuleCard({ rule, fields, onDelete }: {
  rule: ConditionalRuleOut
  fields: FormFieldOut[]
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const trigger = fields.find(f => f.id === rule.trigger_field_id)
  const target  = fields.find(f => f.id === rule.target_field_id)
  const op = OPERATORS.find(o => o.value === rule.operator)
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 group hover:border-primary-200 hover:shadow-sm transition-all">
      <div className="bg-violet-100 p-2 rounded-lg shrink-0 mt-0.5">
        <Zap className="w-3.5 h-3.5 text-violet-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-1.5 text-sm">
          <span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">{t('rules.if','IF')}</span>
          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-medium truncate max-w-[140px]">
            {trigger?.label ?? `${t('rules.field','Field')} #${rule.trigger_field_id}`}
          </span>
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg text-xs font-mono">
            {t(`rules.operator.${rule.operator}`, { defaultValue: op?.label ?? rule.operator })}
          </span>
          {rule.operator !== 'not_empty' && (
            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg font-medium">
              "{rule.trigger_value}"
            </span>
          )}
        </div>
        <div className="flex items-center flex-wrap gap-1.5 text-sm mt-1.5">
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">{t('rules.then','THEN')}</span>
          <span className={`px-2 py-0.5 rounded-lg font-bold text-xs uppercase tracking-wide ${
            rule.action === 'show' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
          }`}>{t(`rules.action.${rule.action}`, { defaultValue: rule.action })}</span>
          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-medium truncate max-w-[140px]">
            {target?.label ?? `${t('rules.field','Field')} #${rule.target_field_id}`}
          </span>
        </div>
      </div>
      <button onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function AddRulePanel({ fields, onAdd, onClose }: {
  fields: FormFieldOut[]
  onAdd: (data: Omit<ConditionalRuleOut, 'id'|'form_version_id'|'created_at'>) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [triggerId, setTriggerId] = useState<number | ''>('')
  const [operator,  setOperator]  = useState('equals')
  const [value,     setValue]     = useState('')
  const [targetId,  setTargetId]  = useState<number | ''>('')
  const [action,    setAction]    = useState('show')
  // Extra conditions (AND logic)
  type Condition = { triggerId: number | ''; operator: string; value: string }
  const [extraConditions, setExtraConditions] = useState<Condition[]>([])
  const [testValue, setTestValue] = useState('')
  const triggerField = fields.find(f => f.id === Number(triggerId))
  const triggerOpts  = Array.isArray(triggerField?.options) ? (triggerField.options as string[]) : []
  const needsValue   = operator !== 'not_empty'

  // Live preview — does current test value satisfy the primary condition?
  const previewMet = (() => {
    if (!triggerId || !testValue)
  return null
    switch (operator) {
      case 'equals':       return testValue === value
      case 'not_equals':   return testValue !== value
      case 'contains':     return testValue.toLowerCase().includes(value.toLowerCase())
      case 'not_empty':    return testValue.trim().length > 0
      case 'greater_than': return Number(testValue) > Number(value)
      case 'less_than':    return Number(testValue) < Number(value)
      default:             return null
    }
  })()
  const addExtraCondition = () =>
    setExtraConditions(prev => [...prev, { triggerId: '', operator: 'equals', value: '' }])
  const updateExtra = (i: number, key: keyof Condition, val: string | number) =>
    setExtraConditions(prev => { const c = [...prev]; c[i] = { ...c[i], [key]: val }; return c })
  const removeExtra = (i: number) =>
    setExtraConditions(prev => prev.filter((_, j) => j !== i))
  const handleAdd = () => {
    if (!triggerId || !targetId) { toast.error(t('rules.select_trigger_target','Select trigger and target fields')); return }
    if (Number(triggerId) === Number(targetId)) { toast.error(t('rules.trigger_target_different','Trigger and target must be different fields')); return }
    if (needsValue && !value.trim() && operator !== 'not_empty') { toast.error(t('rules.enter_value','Enter a value to match against')); return }

    // Primary rule
    onAdd({ trigger_field_id: Number(triggerId), operator, trigger_value: needsValue ? value : '', target_field_id: Number(targetId), action })

    // Extra AND conditions — each creates its own rule targeting the same field
    for (const cond of extraConditions) {
      if (!cond.triggerId || !cond.value.trim()) continue
      onAdd({ trigger_field_id: Number(cond.triggerId), operator: cond.operator, trigger_value: cond.value, target_field_id: Number(targetId), action })
    }
  }

  return (
    <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-2xl border border-violet-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-600" />
          <h3 className="font-semibold text-gray-900 text-sm">{t('rules.new_rule','New Conditional Rule')}</h3>
          <span className="text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">{t('rules.if_then','IF → THEN')}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/60"><X className="w-4 h-4 text-gray-400" /></button>
      </div>

      {/* Step 1: Primary IF condition */}
      <div className="bg-white rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">{t('rules.step1_title','Step 1 · IF this condition is true…')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">{t('rules.field','Field')}</label>
            <select className="input" value={triggerId} onChange={e => { setTriggerId(e.target.value ? Number(e.target.value) : ''); setValue('') }}>
              <option value="">{t('rules.select_field','Select field…')}</option>
              {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('rules.condition','Condition')}</label>
            <select className="input" value={operator} onChange={e => setOperator(e.target.value)}>
              {OPERATORS.map(o => <option key={o.value} value={o.value}>{t(`rules.operator.${o.value}`, { defaultValue: o.label })}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('rules.value','Value')} {operator === 'not_empty' && <span className="text-gray-400 font-normal">({t('rules.not_needed','not needed')})</span>}</label>
            {triggerOpts.length > 0 ? (
              <select className="input" value={value} onChange={e => setValue(e.target.value)} disabled={!needsValue}>
                <option value="">{t('rules.select_option','Select…')}</option>
                {triggerOpts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input className="input" placeholder={operator === 'not_empty' ? '—' : t('rules.enter_value_placeholder','Enter value…')}
                value={value} onChange={e => setValue(e.target.value)} disabled={!needsValue} />
            )}
          </div>
        </div>

        {/* Live test */}
        {triggerId && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-gray-500">{t('rules.test_this_condition','Test this condition:')}</p>
            <div className="flex items-center gap-2">
              <input className="input flex-1 text-sm py-1.5" placeholder={t('rules.simulate_value','Simulate a value for "{{field}}"…', { field: triggerField?.label ?? '' })}
                value={testValue} onChange={e => setTestValue(e.target.value)} />
              {testValue && previewMet !== null && (
                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap ${
                  previewMet ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                }`}>
                  {previewMet ? t('rules.rule_fires','✓ Rule fires') : t('rules.rule_skipped','✗ Rule skipped')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Extra AND conditions */}
      {extraConditions.map((cond, i) => {
        const ef = fields.find(f => f.id === Number(cond.triggerId))
  const eopts = Array.isArray(ef?.options) ? (ef.options as string[]) : []
        return (
          <div key={i} className="bg-white rounded-xl p-4 space-y-3 border border-indigo-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{t('rules.and','AND')}</span>
                <p className="text-xs text-gray-500">{t('rules.additional_condition','Additional condition (must also be true)')}</p>
              </div>
              <button onClick={() => removeExtra(i)} className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">{t('rules.field','Field')}</label>
                <select className="input" value={cond.triggerId} onChange={e => updateExtra(i, 'triggerId', e.target.value ? Number(e.target.value) : '')}>
                  <option value="">{t('rules.select_field','Select field…')}</option>
                  {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t('rules.condition','Condition')}</label>
                <select className="input" value={cond.operator} onChange={e => updateExtra(i, 'operator', e.target.value)}>
                  {OPERATORS.map(o => <option key={o.value} value={o.value}>{t(`rules.operator.${o.value}`, { defaultValue: o.label })}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t('rules.value','Value')}</label>
                {eopts.length > 0 ? (
                  <select className="input" value={cond.value} onChange={e => updateExtra(i, 'value', e.target.value)}>
                    <option value="">{t('rules.select_option','Select…')}</option>
                    {eopts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input className="input" placeholder={t('rules.enter_value_placeholder','Enter value…')} value={cond.value}
                    onChange={e => updateExtra(i, 'value', e.target.value)} />
                )}
              </div>
            </div>
          </div>
        )
      })}

      <button onClick={addExtraCondition}
        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 transition-colors">
        <Plus className="w-3.5 h-3.5" /> {t('rules.add_and_condition','Add AND condition')}
      </button>

      {/* Step 2: THEN */}
      <div className="bg-white rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">{t('rules.step2_title','Step 2 · THEN do this…')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t('rules.action_label','Action')}</label>
            <div className="flex gap-2">
              {[
                { val: 'show', label: t('rules.action.show_field','Show field'), cls: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                { val: 'hide', label: t('rules.action.hide_field','Hide field'), cls: 'border-red-400 bg-red-50 text-red-600' },
              ].map(a => (
                <button key={a.val} type="button" onClick={() => setAction(a.val)}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                    action === a.val ? a.cls : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>{a.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{t('rules.target_field','Target Field')}</label>
            <select className="input" value={targetId} onChange={e => setTargetId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">{t('rules.select_field_to_action','Select field to {{action}}…', { action: action === 'show' ? t('rules.action.show','show') : t('rules.action.hide','hide') })}</option>
              {fields.filter(f => f.id !== Number(triggerId)).map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Rule preview summary */}
        {triggerId && targetId && (
          <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${action === 'show' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            <Zap className="w-3 h-3 shrink-0" />
            <span>
              {t('rules.preview_summary','IF {{trigger}} {{operator}}{{value}}{{extra}} → {{action}} {{target}}', {
                trigger: triggerField?.label ?? `${t('rules.field','Field')} #${triggerId}`,
                operator: t(`rules.operator.${operator}`, { defaultValue: OPERATORS.find(o => o.value === operator)?.label ?? operator }),
                value: needsValue && value ? ` "${value}"` : '',
                extra: extraConditions.length > 0 ? ` ${t('rules.more_conditions','AND {{formattedCount}} more condition{{plural}}', { count: extraConditions.length, formattedCount: formatNumber(extraConditions.length, i18n.language), plural: extraConditions.length > 1 ? 's' : '' })}` : '',
                action: t(`rules.action.${action}`, { defaultValue: action }),
                target: fields.find(f => f.id === Number(targetId))?.label ?? `${t('rules.field','Field')} #${targetId}`,
              })}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose}>{t('forms.cancel','Cancel')}</button>
        <button className="btn-primary" onClick={handleAdd}>
          <Plus className="w-4 h-4" /> {extraConditions.length > 0 ? t('rules.add_rule_with_conditions','Add Rule ({{formattedCount}} conditions)', { count: extraConditions.length + 1, formattedCount: formatNumber(extraConditions.length + 1, i18n.language) }) : t('rules.add_rule','Add Rule')}
        </button>
      </div>
    </div>
  )
}

// ── New Version Modal ─────────────────────────────────────────────────────────
function NewVersionModal({ onClose, onSave }: { onClose:()=>void; onSave:(summary:string)=>void }) {
  const { t } = useTranslation()
  const [summary, setSummary] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('forms.create_new_version','Create New Version')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('forms.fields_copied','Fields from the current version will be copied into the new draft.')}</p>
        <label className="label">{t('forms.what_changed','What changed?')} <span className="text-gray-400 font-normal">({t('forms.optional','optional')})</span></label>
        <textarea className="input h-20 resize-none mb-4" autoFocus placeholder={t('forms.new_version_placeholder','e.g. Added contact info section, removed old fields')}
          value={summary} onChange={e => setSummary(e.target.value)} />
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>{t('forms.cancel','Cancel')}</button>
          <button className="btn-primary" onClick={() => onSave(summary)}>
            <GitBranch className="w-4 h-4" /> {t('forms.create_version','Create Version')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main FormBuilderPage ──────────────────────────────────────────────────────
export default function FormBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const formId = Number(id)
  const [form, setForm]     = useState<FormOut | null>(null)
  const [fields, setFields] = useState<FormFieldOut[]>([])
  const [rules, setRules]   = useState<ConditionalRuleOut[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [isEditingMeta, setIsEditingMeta] = useState(false)
  const [isPublic, setIsPublic]       = useState(true)
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [selectedType, setSelectedType]     = useState<string | null>(null)
  const [editingField, setEditingField]     = useState<FormFieldOut | null>(null)
  const [showAddRule, setShowAddRule]       = useState(false)
  const [showNewVersion, setShowNewVersion] = useState(false)
  const [activeTab, setActiveTab] = useState<'fields'|'layout'|'rules'|'languages'|'steps'>('fields')
  const { t } = useTranslation()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const loadData = useCallback(async (silent = false) => {
    if (!formId || isNaN(formId)) return
    try {
      if (!silent) setLoading(true)
  const formData = await formsApi.get(formId)
      setForm(formData); setTitle(formData.title)
      setDescription(formData.description || ''); setIsPublic(formData.is_public)
  const fieldsData = await fieldsApi.list(formId)
      setFields(fieldsData.sort((a, b) => a.order_index - b.order_index))
      try { const r = await rulesApi.list(formId); setRules(r) } catch { setRules([]) }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 404 || status === 403) {
        toast.error(t('forms.form_not_found_or_access_denied','Form not found or access denied'))
        navigate('/forms')
      } else {
        toast.error(t('forms.failed_reload_form_data','Failed to reload form data'))
      }
    } finally { if (!silent) setLoading(false) }
  }, [formId, navigate])

  useEffect(() => { loadData() }, [loadData])
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = fields.findIndex(f => f.id === active.id)
  const newIdx = fields.findIndex(f => f.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const newFields = arrayMove(fields, oldIdx, newIdx).map((f, i) => ({ ...f, order_index: i }))
    setFields(newFields)
    try { await fieldsApi.reorder(formId, newFields.map(f => ({ field_id: f.id, order_index: f.order_index }))) }
    catch { toast.error(t('forms.save_field_order_failed','Failed to save field order')); loadData() }
  }

  const handleSaveMeta = async () => {
    try {
      const updated = await formsApi.update(formId, { title, description, is_public: isPublic })
      setForm(updated); setIsEditingMeta(false); toast.success(t('forms.form_updated','Form updated'))
    } catch { toast.error(t('forms.failed_update_form','Failed to update form')) }
  }

  const handleSaveField = async (data: Partial<FormFieldOut>) => {
    try {
      if (editingField) {
        await fieldsApi.update(editingField.id, data)
        toast.success(t('forms.field_updated','Field updated'))
      } else {
        await fieldsApi.add(formId, { ...data, order_index: fields.length })
        toast.success(t('forms.field_added','Field added'))
      }
      // Clear modal state FIRST, then reload silently so UI stays visible
      setSelectedType(null)
      setEditingField(null)
      loadData(true)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || t('forms.failed_save_field','Failed to save field'))
      // Don't navigate away — just close the modal so the user can try again
      setSelectedType(null)
      setEditingField(null)
    }
  }

  const handleDeleteField = async (fieldId: number) => {
    if (!confirm(t('forms.delete_field_confirm','Delete this field?'))) return
    try { await fieldsApi.delete(fieldId); toast.success(t('forms.field_deleted','Field deleted')); loadData(true) }
    catch { toast.error(t('forms.delete_field_failed','Failed to delete field')) }
  }

  const handleDuplicateField = async (field: FormFieldOut) => {
    try {
      await fieldsApi.add(formId, {
        label: `${field.label} (${t('forms.copy','Copy')})`, field_name: `${field.field_name}_copy_${Date.now()}`,
        field_type: field.field_type, placeholder: field.placeholder,
        is_required: field.is_required, order_index: fields.length,
        options: field.options, layout_config: field.layout_config,
      })
      toast.success(t('forms.field_duplicated','Field duplicated')); loadData(true)    } catch { toast.error(t('forms.failed_duplicate_field','Failed to duplicate field')) }
  }

  const handlePublish = async () => {
    try { const updated = await formsApi.publish(formId); setForm(updated); toast.success(t('forms.form_published','Form published!')) }
    catch { toast.error(t('forms.failed_publish_form','Failed to publish form')) }
  }

  const handleNewVersion = async (summary: string) => {
    try {
      await formsApi.createVersion(formId, summary || undefined)
      toast.success(t('forms.new_draft_version_created','New draft version created!')); setShowNewVersion(false); loadData(false)
    } catch { toast.error(t('forms.failed_create_version','Failed to create version')) }
  }

  const handleAddRule = async (data: Omit<ConditionalRuleOut, 'id'|'form_version_id'|'created_at'>) => {
    try { await rulesApi.create(formId, data); toast.success(t('rules.rule_added','Rule added')); setShowAddRule(false); loadData(true) }
    catch { toast.error(t('rules.failed_add_rule','Failed to add rule')) }
  }

  const handleDeleteRule = async (ruleId: number) => {
    try { await rulesApi.delete(ruleId); toast.success(t('rules.rule_deleted','Rule deleted')); loadData(true) }
    catch { toast.error(t('rules.failed_delete_rule','Failed to delete rule')) }
  }

  // Layout canvas: save new position/size after drag/resize
  const handleLayoutChange = async (fieldId: number, lc: LayoutConfig) => {
    const field = fields.find(f => f.id === fieldId)
    if (!field) return
    const updated = { ...field.layout_config as object, ...lc } as LayoutConfig
    // Optimistic update
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, layout_config: updated } : f))
    try { await fieldsApi.update(fieldId, { layout_config: updated }) }
    catch { toast.error(t('forms.failed_save_layout','Failed to save layout')); loadData(true) }
  }

  if (loading)
  return <div className="p-8 text-center text-gray-400 animate-pulse">{t('forms.loading_form_builder','Loading form builder…')}</div>
  if (!form)
  return <div className="p-8 text-center text-red-500">{t('forms.form_not_found','Form not found')}</div>

  const cv = form.versions.find(v => v.id === form.current_version_id)
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button className="btn-ghost flex items-center gap-1.5 text-sm" onClick={() => navigate('/forms')}>
          <ChevronLeft className="w-4 h-4" /> {t('forms.back_to_forms','Back to Forms')}
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {form.is_published && (
            <a href={`/public/${form.uuid}`} target="_blank" rel="noreferrer"
              className="btn-secondary flex items-center gap-1.5 text-sm">
              <Globe className="w-4 h-4" /> {t('forms.view_form','View Form')}
            </a>
          )}
          <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={() => setShowNewVersion(true)}>
            <GitBranch className="w-4 h-4" /> {t('forms.new_version','New Version')}
          </button>
          {/* Close / Reopen responses */}
          {form.is_published && (
            <button
              onClick={async () => {
                try {
                  const updated = form.accepts_responses
                    ? await formsApi.close(formId)
                    : await formsApi.reopen(formId)
                  setForm(updated)
                  toast.success(updated.accepts_responses ? t('forms.form_reopened','Form reopened') : t('forms.form_closed_no_longer_accepting','Form closed — no longer accepting responses'))
                } catch { toast.error(t('forms.failed_update_form','Failed to update form')) }
              }}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-colors ${
                form.accepts_responses
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {form.accepts_responses
                ? <><StopCircle className="w-4 h-4" /> {t('forms.close_form','Close Form')}</>
                : <><RefreshCw className="w-4 h-4" /> {t('forms.reopen_form','Reopen Form')}</>}
            </button>
          )}
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={handlePublish}>
            <Globe2 className="w-4 h-4" /> {form.is_published ? t('forms.republish','Republish') : t('forms.publish','Publish')}
          </button>
        </div>
      </div>

      {/* Form meta card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        {isEditingMeta ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('forms.form_title','Form Title')}</label>
                <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="label">{t('forms.description','Description')}</label>
                <input className="input" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">{t('forms.visibility','Visibility')}</label>
              <div className="flex gap-3">
                {[{val:true,icon:<Globe className="w-4 h-4"/>,label:t('forms.public','Public'),desc:t('forms.anyone_can_fill','Anyone can fill')},{val:false,icon:<Lock className="w-4 h-4"/>,label:t('forms.private','Private'),desc:t('forms.registered_users_only','Registered users only')}].map(opt => (
                  <button key={String(opt.val)} type="button" onClick={() => setIsPublic(opt.val)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                      isPublic===opt.val ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {opt.icon}<span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-sm" onClick={() => setIsEditingMeta(false)}>{t('forms.cancel','Cancel')}</button>
              <button className="btn-primary text-sm" onClick={handleSaveMeta}>{t('forms.save_changes','Save Changes')}</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{form.title}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                  form.status === 'published' ? 'bg-emerald-100 text-emerald-700' :
                  form.status === 'archived'  ? 'bg-gray-100 text-gray-500' :
                  'bg-amber-100 text-amber-700'
                }`}>{form.status}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  form.is_public ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {form.is_public ? <Globe className="w-3 h-3"/> : <Lock className="w-3 h-3"/>}
                  {form.is_public ? t('forms.public','Public') : t('forms.private','Private')}
                </span>
                {cv && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 flex items-center gap-1">
                    <GitBranch className="w-3 h-3"/>{t('forms.version_with_number','v{{num}}',{ num: cv.version_number })}
                  </span>
                )}
              </div>
              <p className="text-gray-400 mt-1 text-sm">{form.description || t('forms.no_description','No description.')}</p>            </div>
            <button className="btn-secondary text-xs shrink-0" onClick={() => setIsEditingMeta(true)}>
              <Edit3 className="w-3 h-3" /> {t('forms.edit','Edit')}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-0">
        {([
          { key:'fields',    label:t('forms.tab_fields','Fields'),           count: fields.length },
          { key:'layout',    label:t('forms.tab_canvas','🎨 Canvas'),          count: null },
          { key:'rules',     label:t('forms.tab_conditional_logic','Conditional Logic'),count: rules.length },
          { key:'languages', label:t('forms.tab_languages','🌐 Languages'),     count: null },
          { key:'steps',     label:t('forms.tab_steps','📋 Steps'),          count: null },
        ] as const).map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab===tab.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            {tab.label}{tab.count !== null ? ` (${formatNumber(tab.count, i18n.language)})` : ''}
          </button>
        ))}
      </div>

      {/* Fields tab */}
      {activeTab === 'fields' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{formatNumber(fields.length, i18n.language)} {fields.length === 1 ? t('forms.field_singular','field') : t('forms.field_plural','fields')} · {t('forms.drag_to_reorder','drag to reorder')} · {t('forms.click_width_button','click width button in edit modal to resize')}</p>
            <button className="btn-primary text-sm" onClick={() => setShowTypePicker(true)}>
              <Plus className="w-4 h-4" /> {t('forms.add_field','Add Field')}
            </button>
          </div>
          {fields.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center space-y-3">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
                <Plus className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-gray-400 font-medium">{t('forms.no_fields_yet','No fields yet')}</p>
              <button className="btn-primary" onClick={() => setShowTypePicker(true)}>{t('forms.add_first_field','Add First Field')}</button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map(field => (
                    <SortableField key={field.id} field={field}
                      onEdit={() => { setEditingField(field); setSelectedType(field.field_type) }}
                      onDelete={() => handleDeleteField(field.id)}
                      onDuplicate={() => handleDuplicateField(field)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {/* Layout canvas tab */}
      {activeTab === 'layout' && <DragDropCanvas fields={fields} onLayoutChange={handleLayoutChange} />}

      {/* Rules tab */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {rules.length > 0 ? t('rules.rules_active_count','{{formattedCount}} rule{{plural}} active', { count: rules.length, formattedCount: formatNumber(rules.length, i18n.language), plural: rules.length !== 1 ? 's' : '' }) : t('rules.no_rules_yet_text','No rules yet — show or hide fields based on answers')}
            </p>
            <button className="btn-primary text-sm" onClick={() => setShowAddRule(v => !v)}>
              <Plus className="w-4 h-4" /> {t('rules.add_rule','Add Rule')}
            </button>
          </div>

          {showAddRule && fields.length < 2 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {t('rules.need_two_fields','You need at least 2 fields to create a conditional rule.')}
            </div>
          )}

          {showAddRule && fields.length >= 2 && (
            <AddRulePanel fields={fields} onAdd={handleAddRule} onClose={() => setShowAddRule(false)} />
          )}

          {rules.length === 0 && !showAddRule && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
              <Zap className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="font-medium">{t('rules.no_conditional_rules','No conditional rules')}</p>
              <p className="text-sm mt-1">{t('rules.rules_explain','Rules let you show or hide fields based on what a user enters.')}</p>
            </div>
          )}

          <div className="space-y-2">
            {rules.map(rule => (
              <RuleCard key={rule.id} rule={rule} fields={fields} onDelete={() => handleDeleteRule(rule.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Languages tab */}
      {activeTab === 'languages' && <LanguagesTab formId={formId} fields={fields} />}

      {/* Steps tab */}
      {activeTab === 'steps' && <StepsManager formId={formId} fields={fields} onFieldsChange={() => loadData(true)} />}

      {/* Modals */}
      {showTypePicker && <FieldTypePicker onPick={t => { setShowTypePicker(false); setSelectedType(t) }} onClose={() => setShowTypePicker(false)} />}
      {(selectedType || editingField) && (
        <FieldModal
          initial={editingField || undefined}
          fieldType={selectedType || editingField?.field_type || 'text'}
          onSave={handleSaveField}
          onClose={() => { setSelectedType(null); setEditingField(null) }}
        />
      )}
      {showNewVersion && <NewVersionModal onClose={() => setShowNewVersion(false)} onSave={handleNewVersion} />}
    </div>
  )
}