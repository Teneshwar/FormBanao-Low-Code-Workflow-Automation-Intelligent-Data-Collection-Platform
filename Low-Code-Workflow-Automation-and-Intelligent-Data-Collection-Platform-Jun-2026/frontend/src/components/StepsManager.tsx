import { useEffect, useState } from 'react'
import i18n from '../i18n'
import { useTranslation } from 'react-i18next'
import { stepsApi } from '../lib/apiModules'
import { formatNumber } from '../lib/localeUtils'
import type { FormStepOut, FormFieldOut } from '../lib/types'
import toast from 'react-hot-toast'
import { Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronUp, Layers } from 'lucide-react'

interface Props {
  formId: number
  fields: FormFieldOut[]
  onFieldsChange: () => void
}

export default function StepsManager({ formId, fields, onFieldsChange }: Props) {
  const [steps, setSteps]       = useState<FormStepOut[]>([])
  const [loading, setLoading]   = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc]   = useState('')
  const [newTitle, setNewTitle]   = useState('')
  const [expanded, setExpanded]   = useState<number | null>(null)
  const { t } = useTranslation()
  const load = () => {
    setLoading(true)
    stepsApi.list(formId)
      .then(setSteps)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [formId])
  const handleAddStep = async () => {
    if (!newTitle.trim()) return
    try {
      await stepsApi.create(formId, { title: newTitle.trim() })
      setNewTitle(''); toast.success(t('steps.added','Step added')); load()
    } catch { toast.error(t('steps.add_failed','Failed to add step')) }
  }

  const handleUpdateStep = async (stepId: number) => {
    try {
      await stepsApi.update(formId, stepId, { title: editTitle, description: editDesc })
      setEditingId(null); toast.success(t('steps.updated','Step updated')); load()
    } catch { toast.error(t('steps.update_failed','Failed to update step')) }
  }

  const handleDeleteStep = async (stepId: number) => {
    if (!confirm(t('steps.delete_confirm','Delete this step? Fields in it will become unassigned.'))) return
    try { await stepsApi.delete(formId, stepId); toast.success(t('steps.deleted','Step deleted')); load(); onFieldsChange() }
    catch { toast.error(t('steps.delete_failed','Failed to delete step')) }
  }

  const handleAssignField = async (stepId: number, fieldId: number, assign: boolean) => {
    try {
      await stepsApi.assignField(formId, assign ? stepId : 0, fieldId)
      toast.success(assign ? t('steps.field_added','Field added to step') : t('steps.field_removed','Field removed from step'))
      onFieldsChange()
    } catch { toast.error(t('steps.assign_failed','Failed to assign field')) }
  }

  if (loading)
  return <div className="p-8 text-center text-gray-400">{t('steps.loading','Loading steps…')}</div>

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1 flex items-center gap-2"><Layers className="w-4 h-4" /> {t('steps.title','Multi-Step Forms')}</p>
        <p className="text-blue-700 text-xs">
          {t('steps.description','Break your form into pages. Create steps below, then assign fields to each step. When filling the form, respondents see one step at a time with a progress bar.')}
        </p>
      </div>

      {/* Add step */}
      <div className="flex gap-2">
        <input className="input flex-1" placeholder={t('steps.new_placeholder','New step title (e.g. Personal Info, Work Experience…)')}
          value={newTitle} onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddStep() }} />
        <button className="btn-primary whitespace-nowrap" onClick={handleAddStep} disabled={!newTitle.trim()}>
          <Plus className="w-4 h-4" /> {t('steps.add_button','Add Step')}
        </button>
      </div>

      {/* Steps list */}
      {steps.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
          <Layers className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">{t('steps.no_steps_yet','No steps yet')}</p>
          <p className="text-sm mt-1">{t('steps.no_steps_prompt','Add a step above to start building a multi-page form')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div key={step.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Step header */}
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  {editingId === step.id ? (
                    <div className="space-y-2">
                      <input className="input py-1.5 text-sm" value={editTitle}
                        onChange={e => setEditTitle(e.target.value)} autoFocus />
                      <input className="input py-1.5 text-sm" placeholder={t('steps.description_placeholder','Description (optional)')}
                        value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-gray-900">{step.title}</p>
                      {step.description && <p className="text-xs text-gray-400">{step.description}</p>}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {editingId === step.id ? (
                    <>
                      <button onClick={() => handleUpdateStep(step.id)}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(step.id); setEditTitle(step.title); setEditDesc(step.description || '') }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setExpanded(expanded === step.id ? null : step.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                        {expanded === step.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleDeleteStep(step.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Field assignment (expanded) */}
              {expanded === step.id && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    {t('steps.assign_fields','Assign fields to this step')}
                  </p>
                  {fields.length === 0 ? (
                    <p className="text-sm text-gray-400">{t('steps.no_fields','No fields yet — add fields in the Fields tab first.')}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {fields.map(field => {
                        // Check if this field is "in" this step by matching step_id stored in layout_config
                        // Since FormFieldOut doesn't expose step_id, we use layout_config.step_id as a hint
                        // For now we show all fields with a toggle
                        const isInStep = field.step_id === step.id
                        return (
                          <label key={field.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                              isInStep ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'
                            }`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                              isInStep ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                            }`}>
                              {isInStep && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                            <span className="text-sm text-gray-800">{field.label}</span>
                            <span className="text-xs text-gray-400 ml-auto">{field.field_type}</span>
                            <input type="checkbox" className="sr-only" checked={isInStep}
                              onChange={e => handleAssignField(step.id, field.id, e.target.checked)} />
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Steps summary */}
      {steps.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
        {t('steps.summary','✓ {{formattedCount}} step{{plural}} defined. When published, users will fill the form step-by-step with a progress indicator.',{count: steps.length, formattedCount: formatNumber(steps.length, i18n.language), plural: steps.length !== 1 ? 's' : ''})}
        </div>
      )}
    </div>
  )
}