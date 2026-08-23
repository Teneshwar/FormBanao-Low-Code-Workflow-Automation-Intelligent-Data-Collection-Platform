from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_superuser

router = APIRouter()


def _log(db: Session, action: str, user_id: int, resource_id: Optional[int] = None, ip: Optional[str] = None) -> None:
    db.add(models.AuditLog(
        user_id=user_id,
        action=action,
        resource_type="admin",
        resource_id=resource_id,
        ip_address=ip,
    ))


# ── Submissions ────────────────────────────────────────────────────────────────

@router.delete("/submissions/{submission_id}", status_code=status.HTTP_200_OK, tags=["Admin"])
def delete_submission_admin(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> dict:
    """Admin: delete a specific submission and all its answers."""
    sub = db.query(models.FormSubmission).filter(
        models.FormSubmission.id == submission_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if not sub.form_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    form = db.query(models.Form).filter(models.Form.id == sub.form_id).first()
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _log(db, "submission.deleted_by_admin", current_user.id, resource_id=submission_id,
         ip=request.client.host if request.client else None)
    db.delete(sub)
    db.commit()
    return {"message": f"Submission {submission_id} deleted"}


@router.delete("/form-submissions/{form_id}", status_code=status.HTTP_200_OK, tags=["Admin"])
def delete_all_form_submissions(
    form_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> dict:
    """Admin: delete ALL submissions for a specific form."""
    form = db.query(models.Form).filter(models.Form.id == form_id).first()
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    count = db.query(models.FormSubmission).filter(
        models.FormSubmission.form_id == form_id
    ).count()
    db.query(models.FormSubmission).filter(
        models.FormSubmission.form_id == form_id
    ).delete(synchronize_session=False)
    _log(db, "submissions.bulk_deleted", current_user.id, resource_id=form_id,
         ip=request.client.host if request.client else None)
    db.commit()
    return {"message": f"Deleted {count} submissions for form {form_id}"}


@router.get(
    "/orphaned-submissions",
    response_model=List[schemas.FormSubmissionOut],
    tags=["Admin"],
)
def list_orphaned_submissions(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> List[models.FormSubmission]:
    """Admin: list submissions whose form has been deleted (form_id IS NULL)."""
    # Orphaned submissions cannot be attributed reliably to a tenant, so we do not expose them here.
    return []


@router.get(
    "/submissions/{submission_id}",
    response_model=schemas.SubmissionDetailOut,
    tags=["Admin"],
)
def get_submission(    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> models.FormSubmission:
    submission = db.query(models.FormSubmission).filter(
        models.FormSubmission.id == submission_id
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if not submission.form_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    form = db.query(models.Form).filter(models.Form.id == submission.form_id).first()
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return submission


# ── Responses ─────────────────────────────────────────────────────────────────

@router.get("/responses", response_model=List[schemas.ResponseOut], tags=["Admin"])
def list_responses(
    skip: int = 0,
    limit: int = 50,
    submission_id: Optional[int] = None,
    form_field_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> List[models.SubmissionAnswer]:
    query = (
        db.query(models.SubmissionAnswer)
        .join(models.FormSubmission, models.FormSubmission.id == models.SubmissionAnswer.submission_id)
        .join(models.Form, models.Form.id == models.FormSubmission.form_id)
        .filter(models.Form.owner_id == current_user.id)
    )
    if submission_id:
        query = query.filter(models.SubmissionAnswer.submission_id == submission_id)
    if form_field_id:
        query = query.filter(models.SubmissionAnswer.form_field_id == form_field_id)
    return query.order_by(models.SubmissionAnswer.id.desc()).offset(skip).limit(limit).all()


@router.get("/responses/{response_id}", response_model=schemas.ResponseOut, tags=["Admin"])
def get_response(
    response_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> models.SubmissionAnswer:
    answer = db.query(models.SubmissionAnswer).filter(
        models.SubmissionAnswer.id == response_id
    ).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Response not found")
    submission = db.query(models.FormSubmission).filter(models.FormSubmission.id == answer.submission_id).first()
    if not submission or not submission.form_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    form = db.query(models.Form).filter(models.Form.id == submission.form_id).first()
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return answer


@router.delete("/responses/{response_id}", status_code=status.HTTP_200_OK, tags=["Admin"])
def delete_response(
    response_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> None:
    answer = db.query(models.SubmissionAnswer).filter(
        models.SubmissionAnswer.id == response_id
    ).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Response not found")
    submission = db.query(models.FormSubmission).filter(models.FormSubmission.id == answer.submission_id).first()
    if not submission or not submission.form_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    form = db.query(models.Form).filter(models.Form.id == submission.form_id).first()
    if not form or form.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _log(db, "response.deleted", current_user.id, resource_id=response_id,
         ip=request.client.host if request.client else None)
    db.delete(answer)
    db.commit()


# ── User Management ────────────────────────────────────────────────────────────

@router.get("/users", response_model=List[schemas.AdminUserOut], tags=["Admin"])
def list_all_users(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> List[dict]:
    query = db.query(models.User).filter(models.User.id == current_user.id)
    if search:
        query = query.filter(
            models.User.email.ilike(f"%{search}%") |
            models.User.full_name.ilike(f"%{search}%")
        )
    users = query.order_by(models.User.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for u in users:
        form_count = db.query(func.count(models.Form.id)).filter(models.Form.owner_id == u.id).scalar() or 0
        sub_count = db.query(func.count(models.FormSubmission.id)).filter(
            models.FormSubmission.submitted_by_id == u.id
        ).scalar() or 0
        result.append(schemas.AdminUserOut(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            is_active=u.is_active,
            is_superuser=u.is_superuser,
            created_at=u.created_at,
            form_count=form_count,
            submission_count=sub_count,
        ))
    return result


@router.patch("/users/{user_id}/toggle-active", response_model=schemas.AdminUserOut, tags=["Admin"])
def toggle_user_active(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> schemas.AdminUserOut:
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user.is_active = not user.is_active
    _log(db, f"user.{'activated' if user.is_active else 'deactivated'}", current_user.id,
         resource_id=user_id, ip=request.client.host if request.client else None)
    db.commit()
    db.refresh(user)
    form_count = db.query(func.count(models.Form.id)).filter(models.Form.owner_id == user.id).scalar() or 0
    sub_count = db.query(func.count(models.FormSubmission.id)).filter(
        models.FormSubmission.submitted_by_id == user.id
    ).scalar() or 0
    return schemas.AdminUserOut(
        id=user.id, email=user.email, full_name=user.full_name,
        is_active=user.is_active, is_superuser=user.is_superuser,
        created_at=user.created_at, form_count=form_count, submission_count=sub_count,
    )


@router.patch("/users/{user_id}/toggle-superuser", response_model=schemas.AdminUserOut, tags=["Admin"])
def toggle_superuser(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> schemas.AdminUserOut:
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own superuser status")
    user.is_superuser = not user.is_superuser
    _log(db, f"user.{'promoted' if user.is_superuser else 'demoted'}", current_user.id,
         resource_id=user_id, ip=request.client.host if request.client else None)
    db.commit()
    db.refresh(user)
    form_count = db.query(func.count(models.Form.id)).filter(models.Form.owner_id == user.id).scalar() or 0
    sub_count = db.query(func.count(models.FormSubmission.id)).filter(
        models.FormSubmission.submitted_by_id == user.id
    ).scalar() or 0
    return schemas.AdminUserOut(
        id=user.id, email=user.email, full_name=user.full_name,
        is_active=user.is_active, is_superuser=user.is_superuser,
        created_at=user.created_at, form_count=form_count, submission_count=sub_count,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK, tags=["Admin"])
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> dict:
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account from admin panel")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _log(db, "user.deleted_by_admin", current_user.id, resource_id=user_id,
         ip=request.client.host if request.client else None)
    db.delete(user)
    db.commit()
    return {"message": f"User {user_id} deleted"}


# ── All Forms (admin view) ─────────────────────────────────────────────────────

@router.get("/forms", response_model=List[schemas.AdminFormOut], tags=["Admin"])
def list_all_forms(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> List[schemas.AdminFormOut]:
    query = db.query(models.Form).filter(models.Form.owner_id == current_user.id)
    if status_filter:
        query = query.filter(models.Form.status == status_filter)
    if search:
        query = query.filter(models.Form.title.ilike(f"%{search}%"))
    forms = query.order_by(models.Form.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for f in forms:
        sub_count = db.query(func.count(models.FormSubmission.id)).filter(
            models.FormSubmission.form_id == f.id
        ).scalar() or 0
        owner = db.query(models.User).filter(models.User.id == f.owner_id).first()
        result.append(schemas.AdminFormOut(
            id=f.id, title=f.title, description=f.description,
            owner_id=f.owner_id, owner_email=owner.email if owner else None,
            is_published=f.is_published, is_public=f.is_public,
            status=f.status, uuid=f.uuid,
            submission_count=sub_count,
            created_at=f.created_at, updated_at=f.updated_at,
        ))
    return result


@router.delete("/forms/{form_id}", status_code=status.HTTP_200_OK, tags=["Admin"])
def admin_delete_form(
    form_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> dict:
    form = db.query(models.Form).filter(models.Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if form.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _log(db, "form.deleted_by_admin", current_user.id, resource_id=form_id,
         ip=request.client.host if request.client else None)
    db.delete(form)
    db.commit()
    return {"message": f"Form {form_id} deleted"}


# ── Audit Logs ─────────────────────────────────────────────────────────────────

@router.get("/audit-logs", tags=["Admin"])
def list_audit_logs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_superuser),
) -> list:
    logs = (
        db.query(models.AuditLog)
        .filter(models.AuditLog.user_id == current_user.id)
        .order_by(models.AuditLog.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "details": l.details,
            "ip_address": l.ip_address,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]
