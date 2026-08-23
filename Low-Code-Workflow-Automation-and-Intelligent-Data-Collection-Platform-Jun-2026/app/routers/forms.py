from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security.utils import get_authorization_scheme_param
from jose import JWTError, jwt
from sqlalchemy.orm import Session
import os

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user, get_current_superuser, get_optional_user
from .schedules import apply_schedule
from . import translations as _translations
from ..notifications import send_form_published_notification, send_submission_notification, fire_and_forget

load_dotenv()

_SECRET_KEY = os.getenv("SECRET_KEY")
_ALGORITHM = os.getenv("ALGORITHM", "HS256")

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _log_action(
    db: Session,
    action: str,
    user_id: Optional[int] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    log = models.AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(log)


def _get_form_or_404(form_id: int, db: Session) -> models.Form:
    form = db.query(models.Form).filter(models.Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return form


def _assert_owner(form: models.Form, user: models.User) -> None:
    if form.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this form",
        )

def _get_submission_scope_or_404(
    submission_id: int,
    db: Session,
    current_user: models.User,
) -> models.FormSubmission:
    submission = db.query(models.FormSubmission).filter(models.FormSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    if not submission.form_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    form = db.query(models.Form).filter(models.Form.id == submission.form_id).first()
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return submission


def _get_submission_answer_scope_or_404(
    response_id: int,
    db: Session,
    current_user: models.User,
) -> models.SubmissionAnswer:
    answer = db.query(models.SubmissionAnswer).filter(models.SubmissionAnswer.id == response_id).first()
    if not answer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Response not found")
    submission = db.query(models.FormSubmission).filter(models.FormSubmission.id == answer.submission_id).first()
    if not submission or not submission.form_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    form = db.query(models.Form).filter(models.Form.id == submission.form_id).first()
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return answer




# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/", response_model=schemas.FormOut, status_code=status.HTTP_201_CREATED)
def create_form(
    form_in: schemas.FormCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Form:
    # 1. Create Form record
    form = models.Form(
        title=form_in.title,
        description=form_in.description,
        owner_id=current_user.id,
        is_published=False,
    )
    db.add(form)
    db.flush()  # get form.id

    # 2. Create initial FormVersion (draft v1)
    version = models.FormVersion(
        form_id=form.id,
        version_number=1,
        status="draft",
        created_by_id=current_user.id,
        change_summary="Initial draft",
    )
    db.add(version)
    db.flush()  # get version.id

    # 3. Create FormFields linked to this version
    for field_data in (form_in.fields or []):
        field = models.FormField(
            form_version_id=version.id,
            field_name=field_data.field_name,
            field_type=field_data.field_type,
            label=field_data.label,
            placeholder=field_data.placeholder,
            is_required=field_data.is_required if field_data.is_required is not None else False,
            order_index=field_data.order_index if field_data.order_index is not None else 0,
            options=field_data.options,
            validation_rules=field_data.validation_rules,
        )
        db.add(field)

    # 4. Point form to this version (resolves circular FK)
    form.current_version_id = version.id

    # 5. Audit log
    _log_action(
        db,
        action="form.created",
        user_id=current_user.id,
        resource_type="form",
        resource_id=form.id,
        details={"title": form.title},
        ip_address=request.client.host if request.client else None,
    )

    db.commit()
    db.refresh(form)
    return form


@router.get("/", response_model=List[schemas.FormOut])
def list_forms(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.Form]:
    forms = (
        db.query(models.Form)
        .filter(models.Form.owner_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    for form in forms:
        try:
            apply_schedule(form, db)
        except Exception:
            pass
    return forms


@router.get("/{form_id}", response_model=schemas.FormOut)
def get_form(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Form:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)
    try:
        apply_schedule(form, db)
    except Exception:
        pass
    return form



@router.post(
    "/{form_id}/versions",
    response_model=schemas.FormVersionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_new_version(
    form_id: int,
    version_in: schemas.FormVersionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.FormVersion:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)

    latest = (
        db.query(models.FormVersion)
        .filter(models.FormVersion.form_id == form_id)
        .order_by(models.FormVersion.version_number.desc())
        .first()
    )
    next_version_number = (latest.version_number + 1) if latest else 1

    version = models.FormVersion(
        form_id=form_id,
        version_number=next_version_number,
        status="draft",
        change_summary=version_in.change_summary,
        created_by_id=current_user.id,
    )
    db.add(version)
    db.flush()

    # Copy fields from current version into the new draft
    if form.current_version_id:
        source_fields = (
            db.query(models.FormField)
            .filter(models.FormField.form_version_id == form.current_version_id)
            .all()
        )
        for src in source_fields:
            db.add(models.FormField(
                form_version_id=version.id,
                field_name=src.field_name,
                field_type=src.field_type,
                label=src.label,
                placeholder=src.placeholder,
                is_required=src.is_required,
                order_index=src.order_index,
                options=src.options,
                validation_rules=src.validation_rules,
                layout_config=src.layout_config,
                profile_field_mapping=src.profile_field_mapping,
            ))

    form.current_version_id = version.id
    form.updated_at = datetime.utcnow()

    _log_action(
        db,
        action="form.version_created",
        user_id=current_user.id,
        resource_type="form",
        resource_id=form_id,
        details={"version_number": next_version_number},
        ip_address=request.client.host if request.client else None,
    )

    db.commit()
    db.refresh(version)
    return version


@router.post("/{form_id}/publish", response_model=schemas.FormOut)
def publish_form(
    form_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Form:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)

    if not form.current_version_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Form has no version to publish",
        )

    current_version = (
        db.query(models.FormVersion)
        .filter(models.FormVersion.id == form.current_version_id)
        .first()
    )
    if not current_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current version not found",
        )

    now = datetime.utcnow()

    # If the current version is already published, create a new version automatically
    # so each publish creates a new version with the latest fields
    if current_version.status == "published":
        # Get the latest version number
        latest = (
            db.query(models.FormVersion)
            .filter(models.FormVersion.form_id == form_id)
            .order_by(models.FormVersion.version_number.desc())
            .first()
        )
        next_version_number = (latest.version_number + 1) if latest else 1

        new_version = models.FormVersion(
            form_id=form_id,
            version_number=next_version_number,
            status="draft",
            change_summary="Re-published with updates",
            created_by_id=current_user.id,
        )
        db.add(new_version)
        db.flush()

        # Copy fields from current version into the new version
        source_fields = (
            db.query(models.FormField)
            .filter(models.FormField.form_version_id == current_version.id)
            .all()
        )
        for src in source_fields:
            db.add(models.FormField(
                form_version_id=new_version.id,
                field_name=src.field_name,
                field_type=src.field_type,
                label=src.label,
                placeholder=src.placeholder,
                is_required=src.is_required,
                order_index=src.order_index,
                options=src.options,
                validation_rules=src.validation_rules,
                layout_config=src.layout_config,
                profile_field_mapping=src.profile_field_mapping,
            ))

        form.current_version_id = new_version.id
        current_version = new_version

    # Publish the current version
    current_version.status = "published"
    current_version.published_at = now
    form.is_published = True
    form.status = "published"
    form.updated_at = now

    _log_action(
        db,
        action="form.published",
        user_id=current_user.id,
        resource_type="form",
        resource_id=form_id,
        details={"version_id": current_version.id, "version_number": current_version.version_number},
        ip_address=request.client.host if request.client else None,
    )

    db.commit()
    db.refresh(form)

    # Enqueue background translation generation (best-effort)
    try:
        if form.multilingual_enabled:
            from .. import tasks as _tasks
            try:
                _tasks.generate_translations_task.delay(form.id)
            except Exception:
                # If Celery not available, fall back to inline generation (best-effort)
                try:
                    fields = _translations._get_form_fields(form, db)
                    en_t = db.query(models.FormTranslation).filter(
                        models.FormTranslation.form_id == form.id,
                        models.FormTranslation.language_code == "en",
                    ).first()
                    source = en_t.content if en_t and isinstance(en_t.content, dict) else _translations._build_source_content(form, fields)
                    # generate synchronously for a few languages as fallback
                    for lang in schemas.SUPPORTED_LANGUAGES:
                        if lang == "en":
                            existing_en = db.query(models.FormTranslation).filter(
                                models.FormTranslation.form_id == form.id,
                                models.FormTranslation.language_code == "en",
                            ).first()
                            if not existing_en:
                                db.add(models.FormTranslation(
                                    form_id=form.id,
                                    language_code="en",
                                    is_default=(form.default_language or "en") == "en",
                                    content=source,
                                ))
                                db.commit()
                                db.refresh(form)
                            continue
                        translated_content = _translations._auto_translate_content(source, lang)
                        existing = db.query(models.FormTranslation).filter(
                            models.FormTranslation.form_id == form.id,
                            models.FormTranslation.language_code == lang,
                        ).first()
                        if existing:
                            existing.content = translated_content
                            db.commit()
                            db.refresh(existing)
                        else:
                            new_t = models.FormTranslation(
                                form_id=form.id,
                                language_code=lang,
                                is_default=(lang == (form.default_language or "en")),
                                content=translated_content,
                            )
                            db.add(new_t)
                            db.commit()
                            db.refresh(new_t)
                except Exception:
                    pass
    except Exception:
        pass

    # Notify the form owner that their form is now live (non-blocking)
    fire_and_forget(send_form_published_notification(
        owner_email=current_user.email,
        owner_name=current_user.full_name,
        form_title=form.title,
        form_uuid=form.uuid,
    ))

    return form


@router.post(
    "/{form_id}/submit",
    response_model=schemas.FormSubmissionOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_form(
    form_id: int,
    submission_in: schemas.FormSubmissionCreate,
    request: Request,
    db: Session = Depends(get_db),
    authenticated_user: Optional[models.User] = Depends(get_optional_user),
) -> models.FormSubmission:
    form = _get_form_or_404(form_id, db)

    # Preserve the existing authenticated submission endpoint, while enforcing a
    # configured scheduling window when the owner has set one.
    has_schedule = db.query(models.FormSchedule.id).filter(
        models.FormSchedule.form_id == form.id
    ).first()
    if has_schedule and not apply_schedule(form, db):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form is not accepting responses")

    if not form.current_version_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Form has no published version to submit to",
        )

    # Check if form is accepting responses
    if not getattr(form, 'accepts_responses', True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This form is no longer accepting responses.",
        )

    submission = models.FormSubmission(
        form_id=form_id,
        form_version_id=form.current_version_id,
        submitted_by_id=authenticated_user.id if authenticated_user else None,
        ip_address=request.client.host if request.client else None,
    )
    db.add(submission)
    db.flush()

    for ans_data in submission_in.answers:
        db.add(models.SubmissionAnswer(
            submission_id=submission.id,
            form_field_id=ans_data.form_field_id,
            answer_value=ans_data.answer_value,
            answer_json=ans_data.answer_json,
        ))

    # A completed submission replaces the saved, unfinished response.
    if authenticated_user:
        db.query(models.DraftSubmission).filter(
            models.DraftSubmission.form_id == form.id,
            models.DraftSubmission.user_id == authenticated_user.id,
        ).delete(synchronize_session=False)

    _log_action(
        db,
        action="form.submitted",
        user_id=authenticated_user.id if authenticated_user else None,
        resource_type="form",
        resource_id=form_id,
        details={"submission_id": submission.id},
        ip_address=request.client.host if request.client else None,
    )

    db.commit()
    db.refresh(submission)

    # Notify form owner of new submission (non-blocking)
    owner = db.query(models.User).filter(models.User.id == form.owner_id).first()
    if owner:
        submitter_email = authenticated_user.email if authenticated_user else None
        fire_and_forget(send_submission_notification(
            owner_email=owner.email,
            owner_name=owner.full_name,
            form_title=form.title,
            form_uuid=form.uuid,
            submission_id=submission.id,
            submitted_by=submitter_email,
        ))

    return submission


@router.get("/{form_id}/auto-fill", response_model=schemas.AutoFillValuesOut)
def get_auto_fill_values(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> dict:
    form = _get_form_or_404(form_id, db)
    if not form.current_version_id:
        return {"form_id": form_id, "answers": []}

    fields = (
        db.query(models.FormField)
        .filter(models.FormField.form_version_id == form.current_version_id)
        .filter(models.FormField.profile_field_mapping.isnot(None))
        .all()
    )

    auto_fill_answers = []
    for field in fields:
        mapping = field.profile_field_mapping
        val = getattr(current_user, mapping, None) if mapping else None
        auto_fill_answers.append({
            "form_field_id": field.id,
            "field_name": field.field_name,
            "profile_field_mapping": mapping,
            "auto_fill_value": str(val) if val is not None else None,
        })

    return {"form_id": form_id, "answers": auto_fill_answers}


@router.get("/{form_id}/submissions", response_model=List[schemas.FormSubmissionOut])
def list_submissions(
    form_id: int,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.FormSubmission]:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)

    return (
        db.query(models.FormSubmission)
        .filter(models.FormSubmission.form_id == form_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.patch("/{form_id}", response_model=schemas.FormOut)
def patch_form(
    form_id: int,
    form_update: schemas.FormUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Form:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)
    update_payload = form_update.model_dump(exclude_unset=True)
    for attr, value in update_payload.items():
        setattr(form, attr, value)
    form.updated_at = datetime.utcnow()
    _log_action(db, "form.patched", current_user.id, "form", form_id,
                ip_address=request.client.host if request.client else None)
    db.commit()
    db.refresh(form)

    # If multilingual was enabled in this patch, enqueue background translation generation
    try:
        if "multilingual_enabled" in update_payload and update_payload.get("multilingual_enabled"):
            try:
                from .. import tasks as _tasks
                _tasks.generate_translations_task.delay(form.id)
            except Exception:
                # fallback: try a synchronous best-effort generation
                try:
                    fields = _translations._get_form_fields(form, db)
                    en_t = db.query(models.FormTranslation).filter(
                        models.FormTranslation.form_id == form.id,
                        models.FormTranslation.language_code == "en",
                    ).first()
                    source = en_t.content if en_t and isinstance(en_t.content, dict) else _translations._build_source_content(form, fields)
                    for lang in schemas.SUPPORTED_LANGUAGES:
                        if lang == "en":
                            if not en_t:
                                db.add(models.FormTranslation(
                                    form_id=form.id,
                                    language_code="en",
                                    is_default=(form.default_language or "en") == "en",
                                    content=source,
                                ))
                                db.commit()
                                db.refresh(form)
                            continue
                        translated_content = _translations._auto_translate_content(source, lang)
                        existing = db.query(models.FormTranslation).filter(
                            models.FormTranslation.form_id == form.id,
                            models.FormTranslation.language_code == lang,
                        ).first()
                        if existing:
                            existing.content = translated_content
                            db.commit()
                            db.refresh(existing)
                        else:
                            new_t = models.FormTranslation(
                                form_id=form.id,
                                language_code=lang,
                                is_default=(lang == (form.default_language or "en")),
                                content=translated_content,
                            )
                            db.add(new_t)
                            db.commit()
                            db.refresh(new_t)
                except Exception:
                    pass
    except Exception:
        pass

    return form


@router.delete("/{form_id}", status_code=status.HTTP_200_OK)
def delete_form(
    form_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> dict:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)

    _log_action(db, "form.deleted", current_user.id, "form", form_id,
                details={"title": form.title},
                ip_address=request.client.host if request.client else None)

    # 1. Null the circular FK first so form_versions can be deleted
    form.current_version_id = None
    form.is_published = False
    db.flush()

    # 2. Preserve submissions by detaching them from the form (set form_id = NULL is not possible
    # due to NOT NULL constraint). Instead, we keep them by NOT deleting submissions —
    # they remain accessible via the submission_id and submitted_by_id.
    # We only delete steps (which are form-structure data, not user responses).
    import sqlalchemy as _sa
    db.execute(_sa.text("DELETE FROM form_steps WHERE form_version_id IN (SELECT id FROM form_versions WHERE form_id = :fid)"), {"fid": form_id})
    db.flush()

    # 3. Now delete the form (versions, fields, schedules, translations cascade via FK)
    # Submissions are also cascaded via the FK ondelete="CASCADE" we set earlier.
    db.delete(form)
    db.commit()
    return {"message": "Form deleted"}


@router.post("/{form_id}/close", response_model=schemas.FormOut)
def close_form(
    form_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Form:
    """Stop accepting responses without archiving the form. Form stays visible/published."""
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)
    form.accepts_responses = False
    form.updated_at = datetime.utcnow()
    _log_action(db, "form.closed", current_user.id, "form", form_id,
                ip_address=request.client.host if request.client else None)
    db.commit()
    db.refresh(form)
    return form


@router.post("/{form_id}/reopen", response_model=schemas.FormOut)
def reopen_form(
    form_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Form:
    """Re-enable accepting responses."""
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)
    form.accepts_responses = True
    form.updated_at = datetime.utcnow()
    _log_action(db, "form.reopened", current_user.id, "form", form_id,
                ip_address=request.client.host if request.client else None)
    db.commit()
    db.refresh(form)
    return form


@router.post("/{form_id}/archive", response_model=schemas.FormOut)
def archive_form(    form_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Form:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)
    form.status = "archived"
    form.is_published = False
    if form.current_version_id:
        version = db.query(models.FormVersion).filter(
            models.FormVersion.id == form.current_version_id
        ).first()
        if version:
            version.status = "archived"
    _log_action(db, "form.archived", current_user.id, "form", form_id,
                ip_address=request.client.host if request.client else None)
    db.commit()
    db.refresh(form)
    return form


@router.get("/{form_id}/versions", response_model=List[schemas.FormVersionOut])
def list_versions(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.FormVersion]:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)
    return (
        db.query(models.FormVersion)
        .filter(models.FormVersion.form_id == form_id)
        .order_by(models.FormVersion.version_number)
        .all()
    )


# ── Admin Endpoints for Responses/Submissions ──────────────────────────────────

@router.get("/submissions", response_model=List[schemas.FormSubmissionOut])
def list_all_submissions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> List[models.FormSubmission]:
    """Admin-only: List submissions for forms owned by the signed-in admin."""
    return (
        db.query(models.FormSubmission)
        .join(models.Form, models.Form.id == models.FormSubmission.form_id)
        .filter(models.Form.owner_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(models.FormSubmission.submitted_at.desc())
        .all()
    )


@router.get("/submissions/{submission_id}", response_model=schemas.FormSubmissionOut)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> models.FormSubmission:
    """Admin-only: Get a single submission by ID for the current admin scope."""
    submission = _get_submission_scope_or_404(submission_id, db, current_user)
    return submission


@router.delete("/submissions/{submission_id}", status_code=status.HTTP_200_OK)
def delete_submission(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> None:
    """Admin-only: Delete a submission owned by the current admin."""
    submission = _get_submission_scope_or_404(submission_id, db, current_user)

    _log_action(
        db,
        action="submission.deleted",
        user_id=current_user.id,
        resource_type="submission",
        resource_id=submission_id,
        details={"form_id": submission.form_id},
        ip_address=request.client.host if request.client else None,
    )
    db.delete(submission)
    db.commit()


@router.get("/responses", response_model=List[schemas.ResponseOut])
def list_all_responses(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> List[models.SubmissionAnswer]:
    """Admin-only: List answers exposed through forms owned by the current admin."""
    return (
        db.query(models.SubmissionAnswer)
        .join(models.FormSubmission, models.FormSubmission.id == models.SubmissionAnswer.submission_id)
        .join(models.Form, models.Form.id == models.FormSubmission.form_id)
        .filter(models.Form.owner_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(models.SubmissionAnswer.id.desc())
        .all()
    )


@router.get("/responses/{response_id}", response_model=schemas.ResponseOut)
def get_response(
    response_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> models.SubmissionAnswer:
    """Admin-only: Get a single response by ID for the current admin scope."""
    answer = _get_submission_answer_scope_or_404(response_id, db, current_user)
    return answer


@router.delete("/responses/{response_id}", status_code=status.HTTP_200_OK)
def delete_response(
    response_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> None:
    """Admin-only: Delete a response owned by the current admin."""
    answer = _get_submission_answer_scope_or_404(response_id, db, current_user)
    submission = db.query(models.FormSubmission).filter(models.FormSubmission.id == answer.submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    _log_action(
        db,
        action="response.deleted",
        user_id=current_user.id,
        resource_type="response",
        resource_id=response_id,
        details={"form_id": submission.form_id},
        ip_address=request.client.host if request.client else None,
    )
    db.delete(answer)
    db.commit()


# ── AI Form Generation ─────────────────────────────────────────────────────────

import json as _json
import re as _re

def _ai_generate_fields(prompt: str, num_fields: int) -> schemas.AIFormGenerateOut:
    """
    Generate form fields from a text prompt.
    Uses OpenAI if OPENAI_API_KEY is set, otherwise falls back to a smart
    rule-based generator that covers the most common form patterns.
    """
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if openai_key:
        return _openai_generate(prompt, num_fields, openai_key)
    return _rule_based_generate(prompt, num_fields)


def _openai_generate(prompt: str, num_fields: int, api_key: str) -> schemas.AIFormGenerateOut:
    import urllib.request, urllib.error
    system = (
        "You are a form builder assistant. Given a description, return a JSON object with: "
        "title (string), description (string), fields (array of objects with: "
        "field_name, field_type (text/email/tel/number/textarea/select/radio/checkbox/date/rating/toggle), "
        "label, placeholder, is_required (bool), options (array of strings for select/radio/checkbox, else null)). "
        f"Generate exactly {num_fields} fields. Return only valid JSON, no markdown."
    )
    body = _json.dumps({
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 1500,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = _json.loads(resp.read())
        raw = data["choices"][0]["message"]["content"]
        parsed = _json.loads(raw)
        return _parse_ai_response(parsed, num_fields)
    except Exception as e:
        # Fall back to rule-based on any error
        return _rule_based_generate(prompt, num_fields)


def _parse_ai_response(parsed: dict, num_fields: int) -> schemas.AIFormGenerateOut:
    fields = []
    for i, f in enumerate(parsed.get("fields", [])[:num_fields]):
        fields.append(schemas.FormFieldCreate(
            field_name=_re.sub(r'[^a-z0-9_]', '', f.get("field_name", f"field_{i}").lower().replace(" ", "_")) or f"field_{i}",
            field_type=f.get("field_type", "text"),
            label=f.get("label", f"Field {i+1}"),
            placeholder=f.get("placeholder") or None,
            is_required=bool(f.get("is_required", False)),
            order_index=i,
            options=f.get("options") if isinstance(f.get("options"), list) else None,
        ))
    return schemas.AIFormGenerateOut(
        title=parsed.get("title", "New Form"),
        description=parsed.get("description", ""),
        fields=fields,
    )


def _rule_based_generate(prompt: str, num_fields: int) -> schemas.AIFormGenerateOut:
    """Smart rule-based form generation based on keywords in the prompt."""
    p = prompt.lower()

    # Detect form type from prompt
    is_registration = any(w in p for w in ["register", "signup", "sign up", "account", "member"])
    is_contact = any(w in p for w in ["contact", "reach", "inquiry", "enquiry", "get in touch"])
    is_survey = any(w in p for w in ["survey", "feedback", "opinion", "rating", "review", "satisfaction"])
    is_event = any(w in p for w in ["event", "meeting", "conference", "webinar", "rsvp", "attend"])
    is_job = any(w in p for w in ["job", "application", "career", "resume", "cv", "hiring", "position"])
    is_order = any(w in p for w in ["order", "purchase", "buy", "product", "delivery", "shipping"])
    is_medical = any(w in p for w in ["medical", "health", "patient", "appointment", "doctor", "clinic"])
    is_quiz = any(w in p for w in ["quiz", "test", "exam", "assessment", "question"])

    # Build title from prompt
    words = prompt.strip().split()
    title = " ".join(words[:6]).title() if len(words) > 3 else prompt.title()
    title = title.rstrip(".")

    base_fields: list[dict] = []

    if is_registration:
        base_fields = [
            {"field_type": "text",     "label": "Full Name",        "placeholder": "Enter your full name",    "is_required": True},
            {"field_type": "email",    "label": "Email Address",    "placeholder": "you@example.com",         "is_required": True},
            {"field_type": "tel",      "label": "Phone Number",     "placeholder": "+1 (555) 000-0000",       "is_required": False},
            {"field_type": "text",     "label": "Username",         "placeholder": "Choose a username",       "is_required": True},
            {"field_type": "password", "label": "Password",         "placeholder": "Min 8 characters",        "is_required": True},
            {"field_type": "date",     "label": "Date of Birth",    "placeholder": None,                       "is_required": False},
            {"field_type": "select",   "label": "Country",          "placeholder": None, "options": ["United States","United Kingdom","India","Canada","Australia","Other"], "is_required": True},
            {"field_type": "toggle",   "label": "I agree to the Terms and Conditions", "placeholder": None, "is_required": True},
        ]
        description = "Create your account by filling in the details below."

    elif is_contact:
        base_fields = [
            {"field_type": "text",     "label": "Your Name",        "placeholder": "Full name",               "is_required": True},
            {"field_type": "email",    "label": "Email Address",    "placeholder": "you@example.com",         "is_required": True},
            {"field_type": "tel",      "label": "Phone Number",     "placeholder": "+1 (555) 000-0000",       "is_required": False},
            {"field_type": "select",   "label": "Subject",          "options": ["General Inquiry","Support","Sales","Partnership","Other"], "is_required": True},
            {"field_type": "textarea", "label": "Message",          "placeholder": "Write your message here…","is_required": True},
            {"field_type": "select",   "label": "Preferred Contact Method", "options": ["Email","Phone","WhatsApp"], "is_required": False},
            {"field_type": "toggle",   "label": "Subscribe to newsletter", "is_required": False},
        ]
        description = "Get in touch with us. We'll respond within 24 hours."

    elif is_survey:
        base_fields = [
            {"field_type": "text",     "label": "Name (optional)",  "placeholder": "Your name",               "is_required": False},
            {"field_type": "rating",   "label": "Overall Satisfaction", "placeholder": None,                  "is_required": True},
            {"field_type": "radio",    "label": "How did you hear about us?", "options": ["Social Media","Search Engine","Friend","Advertisement","Other"], "is_required": True},
            {"field_type": "checkbox", "label": "What features do you use?", "options": ["Feature A","Feature B","Feature C","Feature D"], "is_required": False},
            {"field_type": "scale",    "label": "How likely are you to recommend us?", "options": {"min": 1, "max": 10}, "is_required": True},
            {"field_type": "select",   "label": "How often do you use our service?", "options": ["Daily","Weekly","Monthly","Rarely","First time"], "is_required": True},
            {"field_type": "textarea", "label": "Any suggestions for improvement?", "placeholder": "Share your thoughts…", "is_required": False},
            {"field_type": "toggle",   "label": "May we contact you for follow-up?", "is_required": False},
        ]
        description = "Your feedback helps us improve. This takes less than 2 minutes."

    elif is_event:
        base_fields = [
            {"field_type": "text",     "label": "Full Name",        "placeholder": "Your full name",          "is_required": True},
            {"field_type": "email",    "label": "Email Address",    "placeholder": "you@example.com",         "is_required": True},
            {"field_type": "tel",      "label": "Phone Number",     "placeholder": "+1 (555) 000-0000",       "is_required": False},
            {"field_type": "text",     "label": "Organization",     "placeholder": "Company or institution",  "is_required": False},
            {"field_type": "select",   "label": "Ticket Type",      "options": ["General","VIP","Student","Speaker","Press"], "is_required": True},
            {"field_type": "number",   "label": "Number of Guests", "placeholder": "Including yourself",     "is_required": True},
            {"field_type": "radio",    "label": "Dietary Requirements", "options": ["None","Vegetarian","Vegan","Halal","Gluten-free"], "is_required": False},
            {"field_type": "textarea", "label": "Special Requests", "placeholder": "Any special needs?",     "is_required": False},
        ]
        description = "Register for the event by completing this form."

    elif is_job:
        base_fields = [
            {"field_type": "text",     "label": "Full Name",        "placeholder": "First and last name",     "is_required": True},
            {"field_type": "email",    "label": "Email Address",    "placeholder": "you@example.com",         "is_required": True},
            {"field_type": "tel",      "label": "Phone Number",     "placeholder": "+1 (555) 000-0000",       "is_required": True},
            {"field_type": "text",     "label": "Position Applied For", "placeholder": "Job title",           "is_required": True},
            {"field_type": "url",      "label": "LinkedIn Profile", "placeholder": "https://linkedin.com/in/…","is_required": False},
            {"field_type": "url",      "label": "Portfolio / GitHub", "placeholder": "https://…",             "is_required": False},
            {"field_type": "select",   "label": "Years of Experience", "options": ["0-1","1-3","3-5","5-10","10+"], "is_required": True},
            {"field_type": "textarea", "label": "Why do you want to join us?", "placeholder": "Tell us about yourself…", "is_required": True},
        ]
        description = "Apply for an open position by completing this application."

    elif is_medical:
        base_fields = [
            {"field_type": "text",     "label": "Patient Name",     "placeholder": "Full legal name",         "is_required": True},
            {"field_type": "date",     "label": "Date of Birth",    "placeholder": None,                       "is_required": True},
            {"field_type": "radio",    "label": "Gender",           "options": ["Male","Female","Non-binary","Prefer not to say"], "is_required": True},
            {"field_type": "tel",      "label": "Phone Number",     "placeholder": "+1 (555) 000-0000",       "is_required": True},
            {"field_type": "email",    "label": "Email Address",    "placeholder": "you@example.com",         "is_required": False},
            {"field_type": "textarea", "label": "Reason for Visit", "placeholder": "Describe your symptoms…","is_required": True},
            {"field_type": "checkbox", "label": "Existing Conditions", "options": ["Diabetes","Hypertension","Asthma","Heart Disease","None"], "is_required": False},
            {"field_type": "date",     "label": "Preferred Appointment Date", "placeholder": None,             "is_required": True},
        ]
        description = "Please fill in your details for your medical appointment."

    else:
        # Generic form — try to extract specific fields mentioned in prompt
        # Look for keywords that suggest specific field types
        base_fields = []
        p_lower = p

        # Detect mentioned field types from prompt keywords
        if any(w in p_lower for w in ["name", "full name", "your name"]):
            base_fields.append({"field_type":"text","label":"Full Name","placeholder":"Enter your full name","is_required":True})
        if any(w in p_lower for w in ["email", "e-mail", "mail"]):
            base_fields.append({"field_type":"email","label":"Email Address","placeholder":"you@example.com","is_required":True})
        if any(w in p_lower for w in ["phone", "mobile", "contact number","tel"]):
            base_fields.append({"field_type":"tel","label":"Phone Number","placeholder":"+1 (555) 000-0000","is_required":False})
        if any(w in p_lower for w in ["age", "date of birth","dob","birthday"]):
            base_fields.append({"field_type":"date","label":"Date of Birth","is_required":False})
        if any(w in p_lower for w in ["address","location","city","state","country"]):
            base_fields.append({"field_type":"address","label":"Address","is_required":False})
        if any(w in p_lower for w in ["comment","message","note","description","feedback","reason","explain","detail","suggest"]):
            base_fields.append({"field_type":"textarea","label":"Message","placeholder":"Write your message here…","is_required":True})
        if any(w in p_lower for w in ["rating","rate","score","review","stars","satisfaction"]):
            base_fields.append({"field_type":"rating","label":"Rating","is_required":False})
        if any(w in p_lower for w in ["agree","consent","terms","condition","accept","confirm"]):
            base_fields.append({"field_type":"toggle","label":"I agree to the terms","is_required":True})
        if any(w in p_lower for w in ["gender","sex"]):
            base_fields.append({"field_type":"radio","label":"Gender","options":["Male","Female","Non-binary","Prefer not to say"],"is_required":False})
        if any(w in p_lower for w in ["budget","price","cost","salary","income","pay"]):
            base_fields.append({"field_type":"number","label":"Budget","placeholder":"Enter amount","is_required":False})
        if any(w in p_lower for w in ["website","url","link","portfolio","github","linkedin"]):
            base_fields.append({"field_type":"url","label":"Website / Portfolio","placeholder":"https://","is_required":False})
        if any(w in p_lower for w in ["upload","attach","file","document","resume","cv","photo","image"]):
            base_fields.append({"field_type":"file","label":"File Upload","is_required":False})
        if any(w in p_lower for w in ["date","when","schedule","time","appointment"]):
            if not any(f.get("field_type") == "date" for f in base_fields):
                base_fields.append({"field_type":"date","label":"Date","is_required":False})
        if any(w in p_lower for w in ["subject","topic","category","type","department","option"]):
            base_fields.append({"field_type":"select","label":"Subject","options":["Option A","Option B","Option C","Other"],"is_required":True})

        # If we couldn't detect enough fields, fall back to generic
        if len(base_fields) < 3:
            base_fields = [
                {"field_type":"text","label":"Full Name","placeholder":"Enter your name","is_required":True},
                {"field_type":"email","label":"Email Address","placeholder":"you@example.com","is_required":True},
                {"field_type":"tel","label":"Phone Number","placeholder":"+1 (555) 000-0000","is_required":False},
                {"field_type":"select","label":"Category","options":["Option A","Option B","Option C","Other"],"is_required":True},
                {"field_type":"textarea","label":"Additional Details","placeholder":"Enter any additional information…","is_required":False},
                {"field_type":"date","label":"Date","placeholder":None,"is_required":False},
                {"field_type":"rating","label":"Rate your experience","placeholder":None,"is_required":False},
                {"field_type":"toggle","label":"I agree to the terms","placeholder":None,"is_required":True},
            ]
            description = f"Please complete this form. {prompt[:100]}"
        else:
            description = f"Please fill in the details below. {prompt[:80]}"

    # Trim/pad to num_fields
    base_fields = base_fields[:num_fields]

    fields = []
    for i, f in enumerate(base_fields):
        fn = _re.sub(r'[^a-z0-9_]', '', f["label"].lower().replace(" ", "_"))[:40] or f"field_{i}"
        opts = f.get("options")
        fields.append(schemas.FormFieldCreate(
            field_name=fn,
            field_type=f["field_type"],
            label=f["label"],
            placeholder=f.get("placeholder"),
            is_required=f.get("is_required", False),
            order_index=i,
            options=opts if isinstance(opts, (list, dict)) else None,
        ))

    return schemas.AIFormGenerateOut(title=title, description=description, fields=fields)


@router.post(
    "/ai-generate",
    response_model=schemas.AIFormGenerateOut,
    tags=["Forms"],
)
def ai_generate_form(
    req: schemas.AIFormGenerateRequest,
    current_user: models.User = Depends(get_current_user),
) -> schemas.AIFormGenerateOut:
    """
    Generate a complete form structure from a natural-language prompt.
    Uses OpenAI GPT if OPENAI_API_KEY is configured, otherwise falls back to
    a smart rule-based generator.
    """
    if not req.prompt or len(req.prompt.strip()) < 5:
        raise HTTPException(status_code=400, detail="Prompt must be at least 5 characters")
    return _ai_generate_fields(req.prompt.strip(), min(max(req.num_fields or 8, 3), 20))
