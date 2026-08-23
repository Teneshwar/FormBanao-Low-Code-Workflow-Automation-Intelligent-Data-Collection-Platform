import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { formsApi } from '../lib/apiModules'
import type { FormOut, FormSubmissionOut } from '../lib/types'
import i18n from '../i18n'
import { formatDateLocal, formatNumber } from '../lib/localeUtils'
import { ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function parseUTC(d: string): Date {
  return new Date(d.endsWith('Z') || d.includes('+') ? d : d + 'Z')
}

export default function SubmissionsPage() {
  const { id } = useParams<{ id: string }>()
  const formId = Number(id)
  const [form, setForm] = useState<FormOut | null>(null)
  const [submissions, setSubmissions] = useState<FormSubmissionOut[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([formsApi.get(formId), formsApi.submissions(formId)])
      .then(([f, s]) => { setForm(f); setSubmissions(s) })
      .finally(() => setLoading(false))
  }, [formId])
  const fieldMap = (form?.versions ?? [])
    .flatMap(v => v.fields)
    .reduce<Record<number, string>>((acc, f) => ({ ...acc, [f.id]: f.label }), {})
  const { t } = useTranslation()
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/forms" className="btn-ghost py-1.5 px-2">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {form?.title ?? t('submissions.formFallback','Form')} — {t('submissions.pageTitle','Submissions')}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('submissions.responses','{{formattedCount}} response{{plural}}',{count: submissions.length, formattedCount: formatNumber(submissions.length, i18n.language), plural: submissions.length !== 1 ? 's' : ''})}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">{t('common.loading','Loading…')}</div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-20 text-gray-400">{t('submissions.no_submissions','No submissions yet.')}</div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub, idx) => (
            <div key={sub.id} className="card overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500">#{formatNumber(idx + 1, i18n.language)}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatDateLocal(parseUTC(sub.submitted_at), i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                  <span className="badge-blue">{t('submissions.answers','{{count}} answer{{plural}}',{count: sub.answers.length, formattedCount: formatNumber(sub.answers.length, i18n.language), plural: sub.answers.length !== 1 ? 's' : ''})}</span>
                  {sub.submitted_by_id && (
                    <span className="badge-green">{t('submissions.authenticated','Authenticated')}</span>
                  )}
                </div>
                {expanded === sub.id
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />
                }
              </button>

              {expanded === sub.id && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[24rem] text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase">
                          <th className="text-left pb-2 font-medium">{t('submissions.field','Field')}</th>
                          <th className="text-left pb-2 font-medium">{t('submissions.answer','Answer')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sub.answers.map(ans => (
                          <tr key={ans.id}>
                            <td className="py-2 pr-4 font-medium text-gray-700 min-w-[38%] sm:w-1/3 align-top">
                              {fieldMap[ans.form_field_id] ?? t('submissions.field_number','Field #{{id}}',{id: ans.form_field_id})}
                            </td>
                            <td className="py-2 text-gray-600">
                              {ans.answer_value ?? (ans.answer_json != null ? JSON.stringify(ans.answer_json) : <span className="text-gray-300 italic">{t('common.empty','—')}</span>)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
