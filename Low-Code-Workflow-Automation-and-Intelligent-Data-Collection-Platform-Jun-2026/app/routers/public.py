from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_optional_user
from datetime import datetime
from .schedules import apply_schedule, _to_utc_naive_db
from ..notifications import send_submission_notification, fire_and_forget

router = APIRouter()


@router.get("/browse",
    response_model=List[schemas.FormOutPublic],
    tags=["Public Forms"],
)
def browse_public_forms(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> List[models.Form]:
    """
    No-auth endpoint — returns all published, public forms for the Browse page.
    Applies schedule windows so forms outside their window are excluded.
    Admin users may still need to browse their own published forms, but they must never see forms owned by other admins.
    """
    current_user = get_optional_user(request, db)

    if current_user and current_user.is_superuser:
        all_forms = (
            db.query(models.Form)
            .filter(models.Form.owner_id == current_user.id)
            .order_by(models.Form.updated_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    elif current_user:
        # Registered users can browse public forms and private forms if available.
        all_forms = (
            db.query(models.Form)
            .order_by(models.Form.updated_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    else:
        all_forms = (
            db.query(models.Form)
            .filter(models.Form.is_public == True)
            .order_by(models.Form.updated_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    result = []
    now = datetime.utcnow()
    for form in all_forms:
        if current_user and current_user.is_superuser and form.owner_id != current_user.id:
            continue

        sched = db.query(models.FormSchedule).filter(models.FormSchedule.form_id == form.id).first()
        if not sched:
            try:
                if apply_schedule(form, db):
                    result.append(form)
            except Exception:
                pass
            continue

        starts = _to_utc_naive_db(sched.starts_at)
        ends = _to_utc_naive_db(sched.ends_at)

        if starts and now < starts:
            continue

        form.scheduled_start_at = starts
        form.scheduled_end_at = ends
        form.is_upcoming = False

        try:
            if apply_schedule(form, db):
                result.append(form)
        except Exception:
            pass

    return result


@router.get(
    "/{uuid}",
    response_model=schemas.FormOutPublic,
    tags=["Public Forms"],
)
def open_public_form(
    uuid: str,
    request: Request,
    db: Session = Depends(get_db),
) -> models.Form:
    """
    Public endpoint — no authentication required for public forms.
    Private forms require authentication (returns 401 if not logged in).
    """
    form = db.query(models.Form).filter(models.Form.uuid == uuid).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    user = get_optional_user(request, db)
    if user and user.is_superuser and user.id != form.owner_id:
        raise HTTPException(status_code=404, detail="Form not found")

    sched = db.query(models.FormSchedule).filter(models.FormSchedule.form_id == form.id).first()
    now = datetime.utcnow()
    if sched:
        s = _to_utc_naive_db(sched.starts_at)
        e = _to_utc_naive_db(sched.ends_at)
        form.scheduled_start_at = s
        form.scheduled_end_at = e
        form.is_upcoming = bool(s and now < s)

        if user and user.is_superuser and user.id != form.owner_id:
            raise HTTPException(status_code=404, detail="Form not found")

        if form.is_upcoming:
            # Upcoming scheduled forms are intentionally visible as a countdown page,
            # but the live form stays blocked until the start time.
            if not form.is_public and not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="This form is private. Please log in to access it.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            if not form.is_public and user and user.is_superuser and user.id != form.owner_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this form")
            return form

        if not apply_schedule(form, db):
            raise HTTPException(status_code=404, detail="Form not found")
    else:
        if not apply_schedule(form, db):
            raise HTTPException(status_code=404, detail="Form not found")

    if not form.is_public:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This form is private. Please log in to access it.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if user.is_superuser and user.id != form.owner_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this form")
        if not user.is_superuser and user.id != form.owner_id:
            # Registered users are allowed to open private forms when available.
            pass

    return form


@router.post(
    "/forms/{uuid}/submit",
    response_model=schemas.FormSubmissionOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Public Forms"],
)
def submit_public_form(
    uuid: str,
    submission_in: schemas.FormSubmissionCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> models.FormSubmission:
    """
    Public endpoint — no authentication required.
    Allows users (anonymous or authenticated) to submit a published form by UUID.
    If authenticated, links submission to user and deletes active draft.
    """
    form = db.query(models.Form).filter(models.Form.uuid == uuid).first()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    # Respect schedule: upcoming scheduled public forms may be visible but NOT submittable until start
    sched = db.query(models.FormSchedule).filter(models.FormSchedule.form_id == form.id).first()
    now = datetime.utcnow()
    if sched:
        s = _to_utc_naive_db(sched.starts_at)
        e = _to_utc_naive_db(sched.ends_at)
        # If form is upcoming (start in future) block submissions
        if s and now < s:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Form is not yet accepting responses")
        # Otherwise, not upcoming (within window or after end) — enforce schedule availability
        if not apply_schedule(form, db):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not accessible")
    else:
        # No schedule — enforce as normal
        if not apply_schedule(form, db):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not accessible")

    if not getattr(form, 'accepts_responses', True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This form is no longer accepting responses.",
        )

    # Honeypot anti-spam check — if _honey is filled, it's a bot
    if submission_in._honey:
        # Silently accept but don't store — bots shouldn't know they failed
        return models.FormSubmission(
            id=0, form_id=form.id, form_version_id=form.current_version_id or 0,
            submitted_at=__import__('datetime').datetime.utcnow()
        )

    if not form.current_version_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Form has no published version",
        )

    authenticated_user = get_optional_user(request, db)

    if authenticated_user and authenticated_user.is_superuser and authenticated_user.id != form.owner_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    # Private forms require authentication for submission too
    if not form.is_public:
        if not authenticated_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This form is private. Please log in to submit.",
            )
        if authenticated_user.id != form.owner_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to submit this form")

    submission = models.FormSubmission(
        form_id=form.id,
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

    if authenticated_user:
        db.query(models.DraftSubmission).filter(
            models.DraftSubmission.form_id == form.id,
            models.DraftSubmission.user_id == authenticated_user.id,
        ).delete(synchronize_session=False)

    db.add(models.AuditLog(
        user_id=authenticated_user.id if authenticated_user else None,
        action="form.public_submitted",
        resource_type="form",
        resource_id=form.id,
        details={"submission_id": submission.id, "uuid": uuid},
        ip_address=request.client.host if request.client else None,
    ))

    db.commit()
    db.refresh(submission)

    # Notify the form owner of the new submission (non-blocking)
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
