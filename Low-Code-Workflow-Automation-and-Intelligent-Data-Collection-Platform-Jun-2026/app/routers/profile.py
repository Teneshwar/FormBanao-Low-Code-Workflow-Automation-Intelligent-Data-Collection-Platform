from __future__ import annotations

import logging
import traceback
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from passlib.context import CryptContext
from sqlalchemy import update
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..notifications import send_password_changed_email, fire_and_forget

logger = logging.getLogger(__name__)

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _log(db: Session, action: str, user_id: int, ip: Optional[str] = None, details: Optional[dict] = None) -> None:
    db.add(models.AuditLog(
        user_id=user_id, action=action, resource_type="user",
        resource_id=user_id, details=details, ip_address=ip,
    ))


@router.get("/me", response_model=schemas.UserOut)
def get_profile(current_user: models.User = Depends(get_current_user)) -> models.User:
    return current_user


@router.get("/submissions", response_model=list[schemas.UserSubmissionOut])
def list_my_submissions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[dict]:
    submissions = (
        db.query(models.FormSubmission)
        .filter(models.FormSubmission.submitted_by_id == current_user.id)
        .order_by(models.FormSubmission.submitted_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    payload = []
    for submission in submissions:
        form = submission.form
        owner = form.owner if form else None
        payload.append(
            {
                "id": submission.id,
                "form_id": submission.form_id,
                "submitted_at": submission.submitted_at,
                "answer_count": len(submission.answers),
                "form_title": form.title if form else None,
                "owner_name": owner.full_name if owner else None,
                "form_uuid": form.uuid if form else None,
            }
        )
    return payload


@router.patch("/me", response_model=schemas.UserOut)
def update_profile(
    profile_in: schemas.ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if profile_in.new_password:
        if not profile_in.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="current_password is required to set a new password",
            )
        if not pwd_context.verify(profile_in.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        current_user.hashed_password = pwd_context.hash(profile_in.new_password)
        _password_changed = True
    else:
        _password_changed = False

    if profile_in.full_name is not None:
        current_user.full_name = profile_in.full_name

    _log(db, "user.profile_updated", current_user.id,
         ip=request.client.host if request.client else None)
    db.commit()
    db.refresh(current_user)

    # Send password-changed notification (non-blocking)
    if _password_changed:
        fire_and_forget(send_password_changed_email(current_user.email, current_user.full_name))

    return current_user


@router.delete("/me", status_code=status.HTTP_200_OK)
def delete_account(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> dict:
    try:
        user_id = current_user.id
        user_email = current_user.email
        ip = request.client.host if request.client else None

        # ── Step 1: Null-out every FK column that points to users.id with
        #   SET NULL semantics.  We do this explicitly in Python so the delete
        #   works even when the live DB constraint was created without the
        #   ON DELETE SET NULL clause (a common drift between models and DB).
        null_updates = [
            (models.AuditLog,        models.AuditLog.user_id),
            (models.UploadedFile,    models.UploadedFile.uploaded_by_id),
            (models.FormVersion,     models.FormVersion.created_by_id),
            (models.FormSubmission,  models.FormSubmission.submitted_by_id),
        ]
        for model_cls, col in null_updates:
            db.execute(
                update(model_cls)
                .where(col == user_id)
                .values({col.key: None})
            )

        db.flush()

        # ── Step 2: Write the tombstone audit entry (user_id=None because
        #   the user is about to be gone; resource_id preserves the old id).
        db.add(models.AuditLog(
            user_id=None,
            action="user.deleted",
            resource_type="user",
            resource_id=user_id,
            details={"email": user_email},
            ip_address=ip,
        ))
        db.flush()

        # ── Step 3: Delete the user — cascades handle user_roles, drafts,
        #   token_blocklist, and owned forms (+ their versions/fields).
        db.delete(current_user)
        db.commit()

        return {"message": "Account deleted successfully"}
    except Exception as exc:
        db.rollback()
        logger.error("delete_account failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Delete failed: {exc}",
        )
