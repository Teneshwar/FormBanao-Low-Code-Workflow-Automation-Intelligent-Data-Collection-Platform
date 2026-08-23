from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter()


def _log(db, action, user_id, resource_id=None, ip=None, details=None):
    db.add(models.AuditLog(
        user_id=user_id, action=action, resource_type="field",
        resource_id=resource_id, ip_address=ip, details=details,
    ))


def _get_field_or_404(field_id: int, db: Session) -> models.FormField:
    field = db.query(models.FormField).filter(models.FormField.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    return field


def _assert_form_owner(field: models.FormField, user: models.User, db: Session) -> None:
    version = db.query(models.FormVersion).filter(
        models.FormVersion.id == field.form_version_id
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    form = db.query(models.Form).filter(models.Form.id == version.form_id).first()
    if not form or form.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")


# ── POST /forms/{form_id}/fields ─────────────────────────────────────────────

@router.post(
    "/forms/{form_id}/fields",
    response_model=schemas.FormFieldOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Fields"],
)
def add_field(
    form_id: int,
    field_in: schemas.FormFieldCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.FormField:
    form = db.query(models.Form).filter(models.Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if form.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if not form.current_version_id:
        raise HTTPException(status_code=400, detail="Form has no current version")

    field = models.FormField(
        form_version_id=form.current_version_id,
        field_name=field_in.field_name,
        field_type=field_in.field_type,
        label=field_in.label,
        placeholder=field_in.placeholder,
        is_required=field_in.is_required or False,
        order_index=field_in.order_index or 0,
        options=field_in.options,
        validation_rules=field_in.validation_rules,
        profile_field_mapping=field_in.profile_field_mapping,
        layout_config=field_in.layout_config,
    )
    db.add(field)
    db.flush()

    # Touch form.updated_at so listings show the correct "last modified" time
    form.updated_at = datetime.utcnow()

    _log(db, "field.created", current_user.id, resource_id=field.id,
         ip=request.client.host if request.client else None)
    db.commit()
    db.refresh(field)
    return field


# ── GET /forms/{form_id}/fields ──────────────────────────────────────────────

@router.get(
    "/forms/{form_id}/fields",
    response_model=List[schemas.FormFieldOut],
    tags=["Fields"],
)
def list_fields(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.FormField]:
    form = db.query(models.Form).filter(models.Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if form.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if not form.current_version_id:
        return []
    return (
        db.query(models.FormField)
        .filter(models.FormField.form_version_id == form.current_version_id)
        .order_by(models.FormField.order_index)
        .all()
    )


# ── GET /fields/{field_id} ───────────────────────────────────────────────────

@router.get("/fields/{field_id}", response_model=schemas.FormFieldOut, tags=["Fields"])
def get_field(
    field_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.FormField:
    field = _get_field_or_404(field_id, db)
    _assert_form_owner(field, current_user, db)
    return field


# ── PATCH /fields/{field_id} ─────────────────────────────────────────────────

@router.patch("/fields/{field_id}", response_model=schemas.FormFieldOut, tags=["Fields"])
def update_field(
    field_id: int,
    field_in: schemas.FormFieldUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.FormField:
    field = _get_field_or_404(field_id, db)
    _assert_form_owner(field, current_user, db)

    for attr, value in field_in.model_dump(exclude_unset=True).items():
        setattr(field, attr, value)

    # Touch form.updated_at
    version = db.query(models.FormVersion).filter(models.FormVersion.id == field.form_version_id).first()
    if version:
        form = db.query(models.Form).filter(models.Form.id == version.form_id).first()
        if form:
            form.updated_at = datetime.utcnow()

    _log(db, "field.updated", current_user.id, resource_id=field_id,
         ip=request.client.host if request.client else None)
    db.commit()
    db.refresh(field)
    return field


# ── DELETE /fields/{field_id} ────────────────────────────────────────────────

@router.delete("/fields/{field_id}", status_code=status.HTTP_200_OK, tags=["Fields"])
def delete_field(
    field_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> None:
    field = _get_field_or_404(field_id, db)
    _assert_form_owner(field, current_user, db)
    _log(db, "field.deleted", current_user.id, resource_id=field_id,
         ip=request.client.host if request.client else None)

    # Touch form.updated_at
    version = db.query(models.FormVersion).filter(models.FormVersion.id == field.form_version_id).first()
    if version:
        form = db.query(models.Form).filter(models.Form.id == version.form_id).first()
        if form:
            form.updated_at = datetime.utcnow()

    db.delete(field)
    db.commit()


# ── POST /forms/{form_id}/reorder-fields ─────────────────────────────────────

@router.post(
    "/forms/{form_id}/reorder-fields",
    response_model=List[schemas.FormFieldOut],
    tags=["Fields"],
)
def reorder_fields(
    form_id: int,
    reorder_in: schemas.FieldReorderRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.FormField]:
    form = db.query(models.Form).filter(models.Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if form.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    for item in reorder_in.fields:
        db.query(models.FormField).filter(
            models.FormField.id == item.field_id,
            models.FormField.form_version_id == form.current_version_id,
        ).update({"order_index": item.order_index})

    _log(db, "field.reordered", current_user.id,
         ip=request.client.host if request.client else None)

    # Touch form.updated_at
    form.updated_at = datetime.utcnow()

    db.commit()

    return (
        db.query(models.FormField)
        .filter(models.FormField.form_version_id == form.current_version_id)
        .order_by(models.FormField.order_index)
        .all()
    )
