// ── Auth ──────────────────────────────────────────────────────────────────────
export interface UserOut {
  id: number
  email: string
  full_name: string | null
  is_active: boolean
  is_superuser: boolean
  created_at: string
}

export interface Token { access_token: string; token_type: string }

// ── Forms ─────────────────────────────────────────────────────────────────────
export type FormStatus = 'draft' | 'published' | 'archived'

export interface LayoutConfig {
  x: number   // column start (0-based, out of 12)
  y: number   // row start (0-based)
  w: number   // column span
  h: number   // row span (in units of ~80px)
}

export interface FormFieldOut {
  id: number
  form_version_id: number
  field_name: string
  field_type: string
  label: string
  placeholder: string | null
  is_required: boolean
  order_index: number
  options: unknown
  validation_rules: unknown
  profile_field_mapping: string | null
  layout_config: LayoutConfig | null
  step_id: number | null
  created_at: string
}

export interface FormVersionOut {
  id: number
  form_id: number
  version_number: number
  status: string
  change_summary: string | null
  created_by_id: number | null
  published_at: string | null
  created_at: string
  fields: FormFieldOut[]
}

export interface FormOut {
  id: number
  title: string
  description: string | null
  owner_id: number
  is_published: boolean
  is_public: boolean
  accepts_responses: boolean
  current_version_id: number | null
  uuid: string
  status: FormStatus
  created_at: string
  updated_at: string
  versions: FormVersionOut[]
}

// ── Submissions ───────────────────────────────────────────────────────────────
export interface SubmissionAnswerOut {
  id: number
  submission_id: number
  form_field_id: number
  answer_value: string | null
  answer_json: unknown
  created_at: string
}

export interface FormSubmissionOut {
  id: number
  form_id: number
  form_version_id: number
  submitted_by_id: number | null
  submitted_at: string
  answers: SubmissionAnswerOut[]
}

export interface UserSubmissionOut {
  id: number
  form_id: number | null
  submitted_at: string
  answer_count: number
  form_title: string | null
  owner_name: string | null
  form_uuid: string | null
}

// ── Drafts ────────────────────────────────────────────────────────────────────
export interface DraftSubmissionOut {
  id: number
  form_id: number
  form_version_id: number
  user_id: number
  answers: { form_field_id: number; answer_value: string | null; answer_json: unknown }[]
  created_at: string
  updated_at: string
}

// ── Schedules ─────────────────────────────────────────────────────────────────
export interface FormScheduleOut {
  id: number
  form_id: number
  starts_at: string | null
  ends_at: string | null
  auto_publish: boolean
  auto_archive: boolean
  created_at: string
  updated_at: string
}

export interface UpcomingFormOut {
  id: number
  title: string
  description: string | null
  uuid: string
  starts_at: string | null
  ends_at: string | null
  is_public: boolean
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export interface DashboardAnalytics {
  total_forms: number
  published_forms: number
  draft_forms: number
  archived_forms: number
  total_users: number
  total_submissions: number
  completed_responses: number
}

export interface FieldStatistic {
  field_id: number
  field_name: string
  field_type: string
  answer_value: string | null
  count: number
}

export interface RatingStatistic { rating: number; count: number }
export interface TimeSeriesPoint { label: string; count: number }

export interface FormAnalytics {
  form_id: number
  title: string
  submission_count: number
  completion_rate: number
  average_rating: number | null
  field_statistics: FieldStatistic[]
  rating_statistics: RatingStatistic[]
}

export interface SubmissionAnalytics {
  form_id: number
  title: string
  total_submissions: number
  completed_responses: number
  today: number
  this_week: number
  this_month: number
  this_year: number
  daily_submissions: TimeSeriesPoint[]
  monthly_submissions: TimeSeriesPoint[]
}

export interface TrendMetric { id: number | null; name: string; count: number }
export interface TrendsAnalytics {
  trending_day: string
  most_submitted_form: TrendMetric | null
  most_used_field: TrendMetric | null
  most_selected_option: TrendMetric | null
}

export interface TopFormMetric { form_id: number; title: string; submission_count: number; status: string }
export interface FieldTypeBreakdown { field_type: string; count: number }

export interface EnhancedDashboardAnalytics extends DashboardAnalytics {
  public_forms: number
  private_forms: number
  top_forms: TopFormMetric[]
  field_type_breakdown: FieldTypeBreakdown[]
  submissions_last_30_days: TimeSeriesPoint[]
}

// ── Conditional Rules ─────────────────────────────────────────────────────────
export interface ConditionalRuleOut {
  id: number
  form_version_id: number
  trigger_field_id: number
  operator: string
  trigger_value: string
  target_field_id: number
  action: string
  created_at: string
}

// ── Uploads ───────────────────────────────────────────────────────────────────
export interface UploadedFileOut {
  id: number
  original_filename: string
  stored_filename: string
  file_size: number
  content_type: string
  uploaded_by_id: number | null
  submission_id: number | null
  uploaded_at: string
}

// ── Public form ───────────────────────────────────────────────────────────────
export interface FormOutPublic {
  id?: number
  uuid: string
  title: string
  description: string | null
  is_public?: boolean
  accepts_responses?: boolean
  versions: FormVersionOut[]
  is_upcoming?: boolean
  scheduled_start_at?: string | null
  scheduled_end_at?: string | null
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export interface AdminUserOut {
  id: number
  email: string
  full_name: string | null
  is_active: boolean
  is_superuser: boolean
  created_at: string
  form_count: number
  submission_count: number
}

export interface AdminFormOut {
  id: number
  title: string
  description: string | null
  owner_id: number
  owner_email: string | null
  is_published: boolean
  is_public: boolean
  status: string
  uuid: string
  submission_count: number
  created_at: string
  updated_at: string
}

export interface AuditLogEntry {
  id: number
  user_id: number | null
  action: string
  resource_type: string | null
  resource_id: number | null
  details: unknown
  ip_address: string | null
  created_at: string
}

// ── Multi-language / Translations ─────────────────────────────────────────────
export interface FieldTranslation {
  label?: string
  placeholder?: string
  help_text?: string
  options?: string[]
}

export interface TranslationContent {
  title?: string
  description?: string
  submit_button?: string
  thank_you_message?: string
  fields?: Record<string, FieldTranslation>
}

export interface FormTranslationOut {
  id: number
  form_id: number
  language_code: string
  language_name: string
  is_default: boolean
  content: TranslationContent
  completion_pct: number
  created_at: string
  updated_at: string
}

export interface FormLanguageSettingsOut {
  form_id: number
  multilingual_enabled: boolean
  default_language: string
  languages: FormTranslationOut[]
}

export const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu',
  mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati', kn: 'Kannada',
  ml: 'Malayalam', pa: 'Punjabi', ar: 'Arabic', ur: 'Urdu',
  fr: 'French', de: 'German', es: 'Spanish', pt: 'Portuguese',
  zh: 'Chinese', ja: 'Japanese', ko: 'Korean', ru: 'Russian',
}

export const RTL_LANGUAGES = new Set(['ar', 'ur', 'he', 'fa'])

// ── AI Generation ─────────────────────────────────────────────────────────────
export interface AIFormGenerateOut {
  title: string
  description: string
  fields: Partial<FormFieldOut>[]
}

// ── FormOut extended ──────────────────────────────────────────────────────────
// Re-exported with multilingual fields (merged into FormOut above for compatibility)
export interface FormOutExtended extends FormOut {
  multilingual_enabled: boolean
  default_language: string
}

// ── Multi-step forms ──────────────────────────────────────────────────────────
export interface FormStepOut {
  id: number
  form_version_id: number
  title: string
  description: string | null
  step_order: number
  created_at: string
}
