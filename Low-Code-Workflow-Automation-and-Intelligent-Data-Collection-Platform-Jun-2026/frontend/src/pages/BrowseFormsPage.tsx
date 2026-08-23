import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formsApi } from '../lib/apiModules'
import type { FormOutPublic } from '../lib/types'
import { Search, FileText, ExternalLink, ClipboardList, Globe, GitBranch, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { formatNumber } from '../lib/localeUtils'

export default function BrowseFormsPage() {
  const { t } = useTranslation()
  const [forms, setForms]       = useState<FormOutPublic[]>([])
  const [filtered, setFiltered] = useState<FormOutPublic[]>([])
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(true)
  const navigate                = useNavigate()

  useEffect(() => {
    formsApi.listPublished()
      .then(data => {
        setForms(data)
        setFiltered(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const q = query.toLowerCase()
    setFiltered(q
      ? forms.filter(f =>
          f.title.toLowerCase().includes(q) ||
          (f.description ?? '').toLowerCase().includes(q)
        )
      : forms
    )
  }, [query, forms])
  const latestVersion = (form: FormOutPublic) => form.versions.slice(-1)[0]
  const fieldCount    = (form: FormOutPublic) => latestVersion(form)?.fields?.length ?? 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('browse.title','Browse Forms')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('browse.subtitle','Your published public forms')}</p>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-lg">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input pl-10"
        placeholder={t('browse.search_placeholder','Search by title or description…')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-sm text-gray-400 mb-5">
          {formatNumber(filtered.length, i18n.language)} {filtered.length !== 1 ? t('browse.plural_forms','forms') : t('browse.singular_form','form')} {t('browse.available','available')}
          {query && ` · ${t('browse.matching','matching')} "${query}"`}
        </p>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse space-y-3">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
              <div className="h-8 bg-gray-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">
            {query ? t('browse.no_match','No forms match your search.') : t('browse.no_public','No public published forms available yet.')}
          </p>
          {query && (
            <button className="mt-3 text-sm text-primary-600 hover:underline" onClick={() => setQuery('')}>
              {t('browse.clear_search','Clear search')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(form => {
            const lv = latestVersion(form)
  const fc = fieldCount(form)
  return (
              <div key={form.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary-200 transition-all flex flex-col">
                <div className="p-5 flex-1">
                  {/* Icon + title */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="bg-primary-100 p-2.5 rounded-xl shrink-0 mt-0.5">
                      <FileText className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 leading-snug">{form.title}</h3>
                      {form.description && (
                        <p className="text-sm text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {form.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {form.is_upcoming ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />{t('browse.upcoming','Upcoming')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{t('browse.live','Live')}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                      <Globe className="w-3 h-3" />{t('browse.public','Public')}
                    </span>
                    {lv && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                        <GitBranch className="w-3 h-3" />{t('browse.version_with_number','v{{num}}', { num: lv.version_number })}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">
                      <Users className="w-3 h-3" />{formatNumber(fc, i18n.language)} {fc === 1 ? t('browse.field','field') : t('browse.fields','fields')}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 border-t border-gray-100 pt-3 space-y-2">
                  <button
                    onClick={() => navigate(`/public/${form.uuid}`)}
                    className="btn-primary w-full justify-center text-sm"
                  >
                    <ExternalLink className="w-4 h-4" /> {form.is_upcoming ? t('browse.view_form','View this form') : t('browse.fill_form','Fill this Form')}
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
