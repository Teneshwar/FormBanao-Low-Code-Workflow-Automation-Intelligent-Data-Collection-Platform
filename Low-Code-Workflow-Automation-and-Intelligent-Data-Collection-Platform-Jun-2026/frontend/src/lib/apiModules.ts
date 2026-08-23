import api from './api'
import type {
  UserOut, Token, FormOut, FormVersionOut, FormFieldOut,
  FormSubmissionOut, DraftSubmissionOut, FormScheduleOut, UpcomingFormOut,
  DashboardAnalytics, EnhancedDashboardAnalytics, FormAnalytics,
  SubmissionAnalytics, TrendsAnalytics, ConditionalRuleOut, UploadedFileOut,
  FormOutPublic, AdminUserOut, AdminFormOut, AuditLogEntry,
  AIFormGenerateOut, FormTranslationOut, FormLanguageSettingsOut,
  FormStepOut, UserSubmissionOut,
} from './types'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (email: string, password: string, full_name?: string, role: 'admin' | 'user' = 'user') =>
    api.post<UserOut>('/auth/register', { email, password, full_name, role }).then(r => r.data),

  firebaseAuth: (idToken: string, full_name?: string, role: 'admin' | 'user' = 'user') =>
    api.post<Token>('/auth/firebase', { id_token: idToken, full_name, role }).then(r => r.data),

  // Persist the user's chosen role server-side so verification from another device still works
  setPendingRole: (email: string, role: 'admin' | 'user' = 'user') =>
    api.post('/auth/pending-role', { email, role }).then(r => r.data),

  cleanupStaleFirebaseUser: (email: string) =>
    api.post<{ deleted: boolean; message: string }>('/auth/cleanup-stale-firebase-user', { email }).then(r => r.data.deleted),

  login: (email: string, password: string, role: 'admin' | 'user' = 'user') => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    form.append('role', role)
    return api.post<Token>('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).then(r => r.data)
  },

  me: () => api.get<UserOut>('/auth/me').then(r => r.data),
  logout: () => api.post('/auth/logout').then(r => r.data),
}

// ── Profile ───────────────────────────────────────────────────────────────────
export const profileApi = {
  get: () => api.get<UserOut>('/profile/me').then(r => r.data),
  update: (data: { full_name?: string; current_password?: string; new_password?: string }) =>
    api.patch<UserOut>('/profile/me', data).then(r => r.data),
  deleteAccount: () => api.delete('/profile/me').then(r => r.data),
  mySubmissions: (skip = 0, limit = 20) =>
    api.get<UserSubmissionOut[]>('/profile/submissions', { params: { skip, limit } }).then(r => r.data),
}

// ── Forms ─────────────────────────────────────────────────────────────────────
export const formsApi = {
  list: (skip = 0, limit = 50) =>
    api.get<FormOut[]>('/api/forms/', { params: { skip, limit } }).then(r => r.data),

  listPublished: () =>
    api.get<FormOutPublic[]>('/public/browse').then(r => r.data),

  get: (id: number) => api.get<FormOut>(`/api/forms/${id}`).then(r => r.data),

  create: (data: { title: string; description?: string; is_public?: boolean }) =>
    api.post<FormOut>('/api/forms', { ...data, fields: [] }).then(r => r.data),

  update: (id: number, data: { title?: string; description?: string; is_public?: boolean }) =>
    api.patch<FormOut>(`/api/forms/${id}`, data).then(r => r.data),

  delete: (id: number) => api.delete(`/api/forms/${id}`).then(r => r.data),

  publish: (id: number) => api.post<FormOut>(`/api/forms/${id}/publish`).then(r => r.data),

  archive: (id: number) => api.post<FormOut>(`/api/forms/${id}/archive`).then(r => r.data),

  close:   (id: number) => api.post<FormOut>(`/api/forms/${id}/close`).then(r => r.data),

  reopen:  (id: number) => api.post<FormOut>(`/api/forms/${id}/reopen`).then(r => r.data),

  createVersion: (id: number, change_summary?: string) =>
    api.post<FormVersionOut>(`/api/forms/${id}/versions`, { change_summary }).then(r => r.data),

  listVersions: (id: number) =>
    api.get<FormVersionOut[]>(`/api/forms/${id}/versions`).then(r => r.data),

  submissions: (id: number) =>
    api.get<FormSubmissionOut[]>(`/api/forms/${id}/submissions`).then(r => r.data),

  autoFill: (id: number) =>
    api.get(`/api/forms/${id}/auto-fill`).then(r => r.data),
}

// ── Fields ────────────────────────────────────────────────────────────────────
export const fieldsApi = {
  list: (formId: number) =>
    api.get<FormFieldOut[]>(`/api/forms/${formId}/fields`).then(r => r.data),
  add: (formId: number, data: Partial<FormFieldOut>) =>
    api.post<FormFieldOut>(`/api/forms/${formId}/fields`, data).then(r => r.data),
  update: (fieldId: number, data: Partial<FormFieldOut>) =>
    api.patch<FormFieldOut>(`/api/fields/${fieldId}`, data).then(r => r.data),
  delete: (fieldId: number) => api.delete(`/api/fields/${fieldId}`).then(r => r.data),
  reorder: (formId: number, fields: { field_id: number; order_index: number }[]) =>
    api.post<FormFieldOut[]>(`/api/forms/${formId}/reorder-fields`, { fields }).then(r => r.data),
}

// ── Conditional Rules ─────────────────────────────────────────────────────────
export const rulesApi = {
  list: (formId: number) =>
    api.get<ConditionalRuleOut[]>(`/api/forms/${formId}/conditional-rules`).then(r => r.data),
  create: (formId: number, data: Omit<ConditionalRuleOut, 'id' | 'form_version_id' | 'created_at'>) =>
    api.post<ConditionalRuleOut>(`/api/forms/${formId}/conditional-rules`, data).then(r => r.data),
  update: (ruleId: number, data: Partial<ConditionalRuleOut>) =>
    api.patch<ConditionalRuleOut>(`/api/conditional-rules/${ruleId}`, data).then(r => r.data),
  delete: (ruleId: number) => api.delete(`/api/conditional-rules/${ruleId}`).then(r => r.data),
}

// ── Drafts ────────────────────────────────────────────────────────────────────
export const draftsApi = {
  list: () => api.get<DraftSubmissionOut[]>('/drafts').then(r => r.data),
  getByForm: (formId: number) =>
    api.get<DraftSubmissionOut>(`/drafts/form/${formId}`).then(r => r.data),
  save: (formId: number, answers: unknown[]) =>
    api.post<DraftSubmissionOut>('/drafts', { form_id: formId, answers }).then(r => r.data),
  update: (draftId: number, answers: unknown[]) =>
    api.put<DraftSubmissionOut>(`/drafts/${draftId}`, { answers }).then(r => r.data),
  delete: (draftId: number) => api.delete(`/drafts/${draftId}`).then(r => r.data),
}

// ── Schedules ─────────────────────────────────────────────────────────────────
export const schedulesApi = {
  list: () => api.get<FormScheduleOut[]>('/schedules').then(r => r.data),
  get: (id: number) => api.get<FormScheduleOut>(`/schedules/${id}`).then(r => r.data),
  upcoming: () => api.get<UpcomingFormOut[]>('/schedules/upcoming').then(r => r.data),
  create: (data: {
    form_id: number; starts_at?: string; ends_at?: string;
    auto_publish?: boolean; auto_archive?: boolean
  }) => api.post<FormScheduleOut>('/schedules/', data).then(r => r.data),
  update: (id: number, data: { starts_at?: string; ends_at?: string; auto_publish?: boolean; auto_archive?: boolean }) =>
    api.put<FormScheduleOut>(`/schedules/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/schedules/${id}`).then(r => r.data),
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: () => api.get<DashboardAnalytics>('/analytics/dashboard').then(r => r.data),
  enhancedDashboard: () => api.get<EnhancedDashboardAnalytics>('/analytics/enhanced-dashboard').then(r => r.data),
  form: (formId: number) => api.get<FormAnalytics>(`/analytics/form/${formId}`).then(r => r.data),
  submission: (formId: number) => api.get<SubmissionAnalytics>(`/analytics/submission/${formId}`).then(r => r.data),
  trends: () => api.get<TrendsAnalytics>('/analytics/trends').then(r => r.data),
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  // Responses
  getSubmission: (id: number) => api.get<FormSubmissionOut>(`/admin/submissions/${id}`).then(r => r.data),
  orphanedSubmissions: (params?: { skip?: number; limit?: number }) =>
    api.get<FormSubmissionOut[]>('/admin/orphaned-submissions', { params }).then(r => r.data),
  deleteSubmission: (id: number) => api.delete(`/admin/submissions/${id}`).then(r => r.data),
  deleteAllFormSubmissions: (formId: number) => api.delete(`/admin/form-submissions/${formId}`).then(r => r.data),
  listResponses: (params?: { skip?: number; limit?: number; submission_id?: number; form_field_id?: number }) =>
    api.get('/admin/responses', { params }).then(r => r.data),
  deleteResponse: (id: number) => api.delete(`/admin/responses/${id}`).then(r => r.data),
  // Users
  listUsers: (params?: { skip?: number; limit?: number; search?: string }) =>
    api.get<AdminUserOut[]>('/admin/users', { params }).then(r => r.data),
  toggleUserActive: (id: number) => api.patch<AdminUserOut>(`/admin/users/${id}/toggle-active`).then(r => r.data),
  toggleSuperuser: (id: number) => api.patch<AdminUserOut>(`/admin/users/${id}/toggle-superuser`).then(r => r.data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`).then(r => r.data),
  // Forms
  listAllForms: (params?: { skip?: number; limit?: number; status_filter?: string; search?: string }) =>
    api.get<AdminFormOut[]>('/admin/forms', { params }).then(r => r.data),
  deleteForm: (id: number) => api.delete(`/admin/forms/${id}`).then(r => r.data),
  // Audit
  auditLogs: (params?: { skip?: number; limit?: number }) =>
    api.get<AuditLogEntry[]>('/admin/audit-logs', { params }).then(r => r.data),
}

// ── Uploads ───────────────────────────────────────────────────────────────────
export const uploadsApi = {
  upload: (file: File, submissionId?: number) => {
    const fd = new FormData()
    fd.append('file', file)
    if (submissionId) fd.append('submission_id', String(submissionId))
    return api.post<UploadedFileOut>('/api/uploads', fd).then(r => r.data)
  },
  get: (id: number) => api.get<UploadedFileOut>(`/api/uploads/${id}`).then(r => r.data),
}

// ── Public ────────────────────────────────────────────────────────────────────
export const publicApi = {
  getForm: (uuid: string) => api.get<FormOutPublic>(`/public/${uuid}`).then(r => r.data),
  submit: (uuid: string, answers: { form_field_id: number; answer_value?: string; answer_json?: unknown }[]) =>
    api.post<FormSubmissionOut>(`/public/forms/${uuid}/submit`, { answers }).then(r => r.data),
}

// ── AI Form Generation ────────────────────────────────────────────────────────
export const aiApi = {
  generate: (prompt: string, num_fields = 8) =>
    api.post<AIFormGenerateOut>('/api/forms/ai-generate', { prompt, num_fields }).then(r => r.data),
}

// ── Translations ──────────────────────────────────────────────────────────────
export const translationsApi = {
  getSettings:    (formId: number) =>
    api.get<FormLanguageSettingsOut>(`/api/forms/${formId}/languages`).then(r => r.data),
  getPublicSettings: (formId: number) =>
    api.get<FormLanguageSettingsOut>(`/api/forms/${formId}/languages/public-settings`).then(r => r.data),
  toggle:         (formId: number) =>
    api.post<FormLanguageSettingsOut>(`/api/forms/${formId}/languages/toggle`).then(r => r.data),
  addLanguage:    (formId: number, lang: string) =>
    api.post<FormTranslationOut>(`/api/forms/${formId}/languages/${lang}`).then(r => r.data),
  updateTranslation: (formId: number, lang: string, content: unknown) =>
    api.put<FormTranslationOut>(`/api/forms/${formId}/languages/${lang}`, { content }).then(r => r.data),
  removeLanguage: (formId: number, lang: string) =>
    api.delete(`/api/forms/${formId}/languages/${lang}`).then(r => r.data),
  setDefault:     (formId: number, lang: string) =>
    api.post<FormLanguageSettingsOut>(`/api/forms/${formId}/languages/${lang}/set-default`).then(r => r.data),
  autoTranslate:  (formId: number, target_languages: string[]) =>
    api.post(`/api/forms/${formId}/auto-translate`, { target_languages }).then(r => r.data),
  getPublic:      (formId: number, lang: string) =>
    api.get<FormTranslationOut>(`/api/forms/${formId}/languages/${lang}/public`).then(r => r.data),
}

// ── Form Steps ────────────────────────────────────────────────────────────────
export const stepsApi = {
  list:   (formId: number) => api.get<FormStepOut[]>(`/api/forms/${formId}/steps`).then(r => r.data),
  create: (formId: number, data: { title: string; description?: string }) =>
    api.post<FormStepOut>(`/api/forms/${formId}/steps`, data).then(r => r.data),
  update: (formId: number, stepId: number, data: { title?: string; description?: string; step_order?: number }) =>
    api.patch<FormStepOut>(`/api/forms/${formId}/steps/${stepId}`, data).then(r => r.data),
  delete: (formId: number, stepId: number) =>
    api.delete(`/api/forms/${formId}/steps/${stepId}`).then(r => r.data),
  assignField: (formId: number, stepId: number, fieldId: number) =>
    api.post<FormFieldOut>(`/api/forms/${formId}/steps/${stepId}/assign-field/${fieldId}`).then(r => r.data),
}
