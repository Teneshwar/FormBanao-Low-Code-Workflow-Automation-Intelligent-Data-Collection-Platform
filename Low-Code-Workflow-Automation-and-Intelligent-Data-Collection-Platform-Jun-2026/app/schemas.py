from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


# ── Auth ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    password: str
    role: Literal["admin", "user"] = "user"

    @field_validator("role")
    @classmethod
    def normalize_role(cls, value: str) -> str:
        return value.strip().lower()


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class FirebaseAuthRequest(BaseModel):
    id_token: str
    full_name: Optional[str] = None
    role: Literal["admin", "user"] | None = None

    @field_validator("role")
    @classmethod
    def normalize_role(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else value.strip().lower()


class PendingRoleCreate(BaseModel):
    email: EmailStr
    role: Literal["admin", "user"]

    @field_validator("role")
    @classmethod
    def normalize_role(cls, value: str) -> str:
        return value.strip().lower()


class CleanupFirebaseUserRequest(BaseModel):
    email: EmailStr


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool
    is_superuser: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


# ── Roles ─────────────────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime


# ── Form Fields ───────────────────────────────────────────────────────────────

class FormFieldCreate(BaseModel):
    field_name: str
    field_type: str
    label: str
    placeholder: Optional[str] = None
    is_required: Optional[bool] = False
    order_index: Optional[int] = 0
    options: Optional[Any] = None
    validation_rules: Optional[Any] = None
    profile_field_mapping: Optional[str] = None
    layout_config: Optional[Any] = None


class FormFieldOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    form_version_id: int
    field_name: str
    field_type: str
    label: str
    placeholder: Optional[str] = None
    is_required: bool
    order_index: int
    options: Optional[Any] = None
    validation_rules: Optional[Any] = None
    profile_field_mapping: Optional[str] = None
    layout_config: Optional[Any] = None
    step_id: Optional[int] = None
    created_at: datetime


# ── Form Versions ─────────────────────────────────────────────────────────────

class FormVersionCreate(BaseModel):
    change_summary: Optional[str] = None


class FormVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    form_id: int
    version_number: int
    status: str
    change_summary: Optional[str] = None
    created_by_id: Optional[int] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    fields: List[FormFieldOut] = []


# ── Forms ─────────────────────────────────────────────────────────────────────

class FormCreate(BaseModel):
    title: str
    description: Optional[str] = None
    is_public: Optional[bool] = True
    fields: Optional[List[FormFieldCreate]] = []


class FormOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    owner_id: int
    is_published: bool
    is_public: bool
    accepts_responses: bool = True
    multilingual_enabled: bool = False
    default_language: str = "en"
    current_version_id: Optional[int] = None
    uuid: str
    status: str
    created_at: datetime
    updated_at: datetime
    versions: List[FormVersionOut] = []


class FormUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None
    multilingual_enabled: Optional[bool] = None
    default_language: Optional[str] = None
    accepts_responses: Optional[bool] = None


# ── Submissions ───────────────────────────────────────────────────────────────

class SubmissionAnswerCreate(BaseModel):
    form_field_id: int
    answer_value: Optional[str] = None
    answer_json: Optional[Any] = None


class FormSubmissionCreate(BaseModel):
    answers: List[SubmissionAnswerCreate]
    _honey: Optional[str] = None  # honeypot — must be empty


class SubmissionAnswerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    submission_id: int
    form_field_id: Optional[int] = None
    answer_value: Optional[str] = None
    answer_json: Optional[Any] = None
    created_at: datetime


class FormSubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    form_id: Optional[int] = None
    form_version_id: Optional[int] = None
    submitted_by_id: Optional[int] = None
    submitted_at: datetime
    answers: List[SubmissionAnswerOut] = []


class UserSubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    form_id: Optional[int] = None
    submitted_at: datetime
    answer_count: int
    form_title: Optional[str] = None
    owner_name: Optional[str] = None
    form_uuid: Optional[str] = None


# Detailed/admin response shapes.  Kept separate so the admin router can
# evolve independently while sharing the same persisted submission fields.
class SubmissionDetailOut(FormSubmissionOut):
    pass


class ResponseOut(SubmissionAnswerOut):
    pass


# ── Saved Draft Responses ────────────────────────────────────────────────────

class DraftSubmissionCreate(BaseModel):
    form_id: int
    answers: List[SubmissionAnswerCreate] = []


class DraftSubmissionUpdate(BaseModel):
    answers: List[SubmissionAnswerCreate]


class DraftSubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    form_id: int
    form_version_id: int
    user_id: int
    answers: List[SubmissionAnswerCreate] = []
    created_at: datetime
    updated_at: datetime


# ── Form Scheduling ──────────────────────────────────────────────────────────

class FormScheduleCreate(BaseModel):
    form_id: int
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    auto_publish: bool = True
    auto_archive: bool = True


class FormScheduleUpdate(BaseModel):
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    auto_publish: Optional[bool] = None
    auto_archive: Optional[bool] = None


class FormScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    form_id: int
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    auto_publish: bool
    auto_archive: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class FieldStatistic(BaseModel):
    field_id: int
    field_name: str
    field_type: str
    answer_value: Optional[str] = None
    count: int


class RatingStatistic(BaseModel):
    rating: int
    count: int


class TimeSeriesPoint(BaseModel):
    label: str
    count: int


class DashboardAnalytics(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_forms: int
    published_forms: int
    draft_forms: int
    archived_forms: int
    total_users: int
    total_submissions: int
    completed_responses: int


class FormAnalytics(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    form_id: int
    title: str
    submission_count: int
    completion_rate: float
    average_rating: Optional[float] = None
    field_statistics: List[FieldStatistic] = []
    rating_statistics: List[RatingStatistic] = []


class SubmissionAnalytics(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    form_id: int
    title: str
    total_submissions: int
    completed_responses: int
    today: int
    this_week: int
    this_month: int
    this_year: int
    daily_submissions: List[TimeSeriesPoint] = []
    monthly_submissions: List[TimeSeriesPoint] = []


class TrendMetric(BaseModel):
    id: Optional[int]
    name: str
    count: int


class TrendsAnalytics(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    trending_day: str
    most_submitted_form: Optional[TrendMetric] = None
    most_used_field: Optional[TrendMetric] = None
    most_selected_option: Optional[TrendMetric] = None


# ── Profile ───────────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


# ── Forms (extended) ──────────────────────────────────────────────────────────

class FormOutPublic(BaseModel):
    """Minimal form shape returned for public (unauthenticated) access."""
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    uuid: str
    title: str
    description: Optional[str] = None
    is_public: bool = True
    accepts_responses: bool = True
    is_upcoming: bool = False
    scheduled_start_at: Optional[datetime] = None
    scheduled_end_at: Optional[datetime] = None
    versions: List[FormVersionOut] = []


class FieldReorderItem(BaseModel):
    field_id: int
    order_index: int


class FieldReorderRequest(BaseModel):
    fields: List[FieldReorderItem]


class FormFieldUpdate(BaseModel):
    field_name: Optional[str] = None
    field_type: Optional[str] = None
    label: Optional[str] = None
    placeholder: Optional[str] = None
    is_required: Optional[bool] = None
    order_index: Optional[int] = None
    options: Optional[Any] = None
    validation_rules: Optional[Any] = None
    profile_field_mapping: Optional[str] = None
    layout_config: Optional[Any] = None


class AutoFillAnswer(BaseModel):
    form_field_id: int
    field_name: str
    profile_field_mapping: str
    auto_fill_value: Optional[str] = None


class AutoFillValuesOut(BaseModel):
    form_id: int
    answers: List[AutoFillAnswer] = []


# ── Uploads ───────────────────────────────────────────────────────────────────

class UploadedFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_filename: str
    stored_filename: str
    file_size: int
    content_type: str
    uploaded_by_id: int
    submission_id: Optional[int] = None
    uploaded_at: datetime


# ── Conditional Rules ─────────────────────────────────────────────────────────

class ConditionalRuleCreate(BaseModel):
    trigger_field_id: int
    operator: str          # equals | not_equals | contains | greater_than | less_than
    trigger_value: str
    target_field_id: int
    action: str = "show"   # show | hide


class ConditionalRuleUpdate(BaseModel):
    operator: Optional[str] = None
    trigger_value: Optional[str] = None
    action: Optional[str] = None


class ConditionalRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    form_version_id: int
    trigger_field_id: int
    operator: str
    trigger_value: str
    target_field_id: int
    action: str
    created_at: datetime


# ── Upcoming forms (scheduled but not yet active) ─────────────────────────────

class UpcomingFormOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    uuid: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_public: bool


# ── Enhanced Analytics ─────────────────────────────────────────────────────────

class TopFormMetric(BaseModel):
    form_id: int
    title: str
    submission_count: int
    status: str


class FieldTypeBreakdown(BaseModel):
    field_type: str
    count: int


class UserActivityPoint(BaseModel):
    label: str
    registrations: int
    submissions: int


class EnhancedDashboardAnalytics(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_forms: int
    published_forms: int
    draft_forms: int
    archived_forms: int
    total_users: int
    total_submissions: int
    completed_responses: int
    public_forms: int
    private_forms: int
    top_forms: List[TopFormMetric] = []
    field_type_breakdown: List[FieldTypeBreakdown] = []
    submissions_last_30_days: List[TimeSeriesPoint] = []


# ── Admin user management ─────────────────────────────────────────────────────

class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: Optional[str] = None
    is_active: bool
    is_superuser: bool
    created_at: datetime
    form_count: int = 0
    submission_count: int = 0


class AdminFormOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    owner_id: int
    owner_email: Optional[str] = None
    is_published: bool
    is_public: bool
    status: str
    uuid: str
    submission_count: int = 0
    created_at: datetime
    updated_at: datetime


# ── AI Form Generation ────────────────────────────────────────────────────────

class AIFormGenerateRequest(BaseModel):
    prompt: str
    num_fields: Optional[int] = 8


class AIFormGenerateOut(BaseModel):
    title: str
    description: str
    fields: List[FormFieldCreate]


# ── Multi-language / Translations ─────────────────────────────────────────────

SUPPORTED_LANGUAGES = [
    "en", "hi", "ta", "te", "mr", "bn", "gu", "kn", "ml", "pa",
    "ar", "ur", "fr", "de", "es", "pt", "zh", "ja", "ko", "ru",
]

LANGUAGE_NAMES: Dict[str, str] = {
    "en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu",
    "mr": "Marathi", "bn": "Bengali", "gu": "Gujarati", "kn": "Kannada",
    "ml": "Malayalam", "pa": "Punjabi", "ar": "Arabic", "ur": "Urdu",
    "fr": "French", "de": "German", "es": "Spanish", "pt": "Portuguese",
    "zh": "Chinese", "ja": "Japanese", "ko": "Korean", "ru": "Russian",
}

RTL_LANGUAGES = {"ar", "ur", "he", "fa"}


class TranslationContent(BaseModel):
    """All translatable strings for one language."""
    title: Optional[str] = None
    description: Optional[str] = None
    submit_button: Optional[str] = None
    thank_you_message: Optional[str] = None
    # field_id -> {label, placeholder, help_text, options: [str]}
    fields: Optional[Dict[str, Any]] = {}


class FormTranslationCreate(BaseModel):
    language_code: str
    content: TranslationContent


class FormTranslationUpdate(BaseModel):
    content: TranslationContent


class FormTranslationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    form_id: int
    language_code: str
    language_name: str
    is_default: bool
    content: Any
    completion_pct: float
    created_at: datetime
    updated_at: datetime


class FormLanguageSettingsOut(BaseModel):
    form_id: int
    multilingual_enabled: bool
    default_language: str
    languages: List[FormTranslationOut]


class AutoTranslateRequest(BaseModel):
    target_languages: List[str]


class FormTranslationBulkOut(BaseModel):
    translations: List[FormTranslationOut]
    missing_warnings: List[str]


# ── Multi-step Forms ──────────────────────────────────────────────────────────

class FormStepCreate(BaseModel):
    title: str = "Step"
    description: Optional[str] = None
    step_order: Optional[int] = 0


class FormStepUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    step_order: Optional[int] = None


class FormStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    form_version_id: int
    title: str
    description: Optional[str] = None
    step_order: int
    created_at: datetime


# ── OTP attempts (logging) ───────────────────────────────────────────────────
class OTPAttemptCreate(BaseModel):
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    event: str  # e.g., 'sent', 'verify_attempt'
    success: bool
    reason: Optional[str] = None

