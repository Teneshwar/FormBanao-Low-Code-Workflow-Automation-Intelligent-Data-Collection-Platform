from __future__ import annotations

from datetime import datetime

import uuid as _uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("UserRole", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    firebase_uid = Column(String(255), unique=True, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    forms = relationship("Form", back_populates="owner", foreign_keys="Form.owner_id", cascade="all, delete-orphan")
    drafts = relationship("DraftSubmission", back_populates="user", cascade="all, delete-orphan")
    token_blocklist = relationship("TokenBlocklist", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", passive_deletes=True)


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    role_id = Column(
        Integer,
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
    )
    assigned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="roles")
    role = relationship("Role", back_populates="users")


class Form(Base):
    __tablename__ = "forms"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_published = Column(Boolean, default=False)
    # True = anyone can see/fill without account; False = only registered users
    is_public = Column(Boolean, default=True)
    # When False, form is visible but not accepting new submissions
    accepts_responses = Column(Boolean, default=True)
    # Multi-language support
    multilingual_enabled = Column(Boolean, default=False)
    default_language = Column(String(10), default="en")
    # Circular FK resolved at ALTER TABLE time to avoid forward-reference issues
    current_version_id = Column(
        Integer,
        ForeignKey(
            "form_versions.id",
            use_alter=True,
            name="fk_form_current_version",
        ),
        nullable=True,
    )
    uuid = Column(String(36), unique=True, nullable=False, default=lambda: str(_uuid.uuid4()), index=True)
    status = Column(
        Enum("draft", "published", "archived", name="form_status"),
        nullable=False,
        default="draft",
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="forms", foreign_keys=[owner_id])
    versions = relationship(
        "FormVersion",
        back_populates="form",
        foreign_keys="FormVersion.form_id",
        cascade="all, delete-orphan",
    )
    submissions = relationship("FormSubmission", back_populates="form")
    translations = relationship("FormTranslation", back_populates="form", cascade="all, delete-orphan")


class FormVersion(Base):
    __tablename__ = "form_versions"
    __table_args__ = (
        UniqueConstraint("form_id", "version_number", name="uq_form_version"),
    )

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(
        Integer,
        ForeignKey("forms.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_number = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="draft")
    change_summary = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    form = relationship(
        "Form",
        back_populates="versions",
        foreign_keys=[form_id],
    )
    fields = relationship(
        "FormField",
        back_populates="form_version",
        cascade="all, delete-orphan",
    )
    created_by = relationship("User", foreign_keys=[created_by_id], passive_deletes=True)


class FormField(Base):
    __tablename__ = "form_fields"

    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(
        Integer,
        ForeignKey("form_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    field_name = Column(String(255), nullable=False)
    field_type = Column(String(50), nullable=False)
    label = Column(String(255), nullable=False)
    placeholder = Column(String(255), nullable=True)
    is_required = Column(Boolean, default=False)
    order_index = Column(Integer, nullable=False, default=0)
    options = Column(JSON, nullable=True)
    validation_rules = Column(JSON, nullable=True)
    profile_field_mapping = Column(String(100), nullable=True)
    # Layout config for drag-drop builder: {x, y, w, h} in grid units
    layout_config = Column(JSON, nullable=True)
    # Optional step assignment for multi-step forms
    step_id = Column(Integer, ForeignKey("form_steps.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    form_version = relationship("FormVersion", back_populates="fields")


class FormSubmission(Base):
    __tablename__ = "form_submissions"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="SET NULL"), nullable=True)
    form_version_id = Column(Integer, ForeignKey("form_versions.id", ondelete="SET NULL"), nullable=True)
    submitted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String(45), nullable=True)
    # Column name in DB is "metadata"; Python attribute is metadata_ to avoid builtin clash
    metadata_ = Column("metadata", JSON, nullable=True)

    form = relationship("Form", back_populates="submissions")
    answers = relationship(
        "SubmissionAnswer",
        back_populates="submission",
        cascade="all, delete-orphan",
    )
    submitted_by = relationship("User", foreign_keys=[submitted_by_id], passive_deletes=True)


class DraftSubmission(Base):
    """An authenticated user's unfinished response for a form version."""
    __tablename__ = "draft_submissions"
    __table_args__ = (
        UniqueConstraint("form_id", "user_id", name="uq_draft_submission_user_form"),
    )

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    form_version_id = Column(Integer, ForeignKey("form_versions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    answers = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    form = relationship("Form")
    form_version = relationship("FormVersion")
    user = relationship("User")


class FormSchedule(Base):
    """Optional publication window for a form (one schedule per form)."""
    __tablename__ = "form_schedules"
    __table_args__ = (UniqueConstraint("form_id", name="uq_form_schedule"),)

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    auto_publish = Column(Boolean, nullable=False, default=True)
    auto_archive = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    form = relationship("Form")


class SubmissionAnswer(Base):
    __tablename__ = "submission_answers"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(
        Integer,
        ForeignKey("form_submissions.id", ondelete="CASCADE"),
        nullable=False,
    )
    form_field_id = Column(Integer, ForeignKey("form_fields.id", ondelete="SET NULL"), nullable=True)
    answer_value = Column(Text, nullable=True)
    answer_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    submission = relationship("FormSubmission", back_populates="answers")
    form_field = relationship("FormField")


class UploadedFile(Base):
    """Stores metadata for uploaded files."""
    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), unique=True, nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)  # In bytes
    content_type = Column(String(100), nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    submission_id = Column(Integer, ForeignKey("form_submissions.id"), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    uploaded_by = relationship("User", passive_deletes=True)
    submission = relationship("FormSubmission")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(Integer, nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")


class TokenBlocklist(Base):
    """Stores invalidated JWT tokens for logout support."""
    __tablename__ = "token_blocklist"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String(36), unique=True, nullable=False, index=True)  # JWT ID claim
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    revoked_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User")


class PendingRole(Base):
    """Temporary server-side record of a registration-time role selection.

    This allows the registration flow to be resilient when the user verifies
    email from another device or browser. Records are short-lived and marked
    used when applied during the Firebase token exchange.
    """
    __tablename__ = "pending_roles"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # ensure expires_at is set if not provided (24h default)
        if not getattr(self, "expires_at", None):
            self.expires_at = datetime.utcnow() + timedelta(hours=24)


class ConditionalRule(Base):
    """Show/hide a target field based on a trigger field's value."""
    __tablename__ = "conditional_rules"

    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(
        Integer,
        ForeignKey("form_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    # The field whose value is evaluated
    trigger_field_id = Column(Integer, ForeignKey("form_fields.id", ondelete="CASCADE"), nullable=False)
    # Operator: "equals", "not_equals", "contains", "greater_than", "less_than"
    operator = Column(String(20), nullable=False)
    # Value to compare against
    trigger_value = Column(String(255), nullable=False)
    # The field to show or hide
    target_field_id = Column(Integer, ForeignKey("form_fields.id", ondelete="CASCADE"), nullable=False)
    # Action: "show" or "hide"
    action = Column(String(10), nullable=False, default="show")
    created_at = Column(DateTime, default=datetime.utcnow)

    form_version = relationship("FormVersion")
    trigger_field = relationship("FormField", foreign_keys=[trigger_field_id])
    target_field = relationship("FormField", foreign_keys=[target_field_id])


class FormTranslation(Base):
    """Stores all translatable strings for a form in one language."""
    __tablename__ = "form_translations"
    __table_args__ = (UniqueConstraint("form_id", "language_code", name="uq_form_translation"),)

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    language_code = Column(String(10), nullable=False)   # e.g. "en", "hi", "ta"
    is_default = Column(Boolean, default=False)
    # JSON blob: {title, description, submit_button, thank_you_message,
    #             fields: {field_id: {label, placeholder, help_text, options:[]}}}
    content = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    form = relationship("Form", back_populates="translations")


class FormStep(Base):
    """A named page/step in a multi-step form. Fields belong to a step via step_id."""
    __tablename__ = "form_steps"
    __table_args__ = (UniqueConstraint("form_version_id", "step_order", name="uq_form_step_order"),)

    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(Integer, ForeignKey("form_versions.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False, default="Step")
    description = Column(Text, nullable=True)
    step_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    form_version = relationship("FormVersion", backref="steps")
