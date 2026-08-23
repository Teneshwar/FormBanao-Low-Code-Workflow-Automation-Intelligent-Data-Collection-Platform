"""CRUD endpoints for form steps (multi-step/multi-page forms)."""
from __future__ import annotations
from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter()


def _get_form_version(form_id: int, db: Session, user: models.User) -> models.FormVersion:
    form = db.query(models.Form).filter(models.Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if form.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if not form.current_version_id:
        raise HTTPException(status_code=400, detail="Form has no current version")
    version = db.query(models.FormVersion).filter(models.FormVersion.id == form.current_version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@router.get("/forms/{form_id}/steps", response_model=List[schemas.FormStepOut])
def list_steps(form_id: int, db: Session = Depends(get_db),
               current_user: models.User = Depends(get_current_user)) -> List[models.FormStep]:
    version = _get_form_version(form_id, db, current_user)
    return db.query(models.FormStep).filter(
        models.FormStep.form_version_id == version.id
    ).order_by(models.FormStep.step_order).all()


@router.post("/forms/{form_id}/steps", response_model=schemas.FormStepOut, status_code=201)
def create_step(form_id: int, step_in: schemas.FormStepCreate,
                db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)) -> models.FormStep:
    version = _get_form_version(form_id, db, current_user)
    # Use MAX(step_order)+1 to avoid uniqueness conflicts
    from sqlalchemy import func as _func
    max_order = db.query(_func.max(models.FormStep.step_order)).filter(
        models.FormStep.form_version_id == version.id
    ).scalar()
    next_order = (max_order + 1) if max_order is not None else 0
    step = models.FormStep(
        form_version_id=version.id,
        title=step_in.title,
        description=step_in.description,
        step_order=next_order,
    )
    db.add(step)
    db.commit()
    db.refresh(step)
    return step


@router.patch("/forms/{form_id}/steps/{step_id}", response_model=schemas.FormStepOut)
def update_step(form_id: int, step_id: int, step_in: schemas.FormStepUpdate,
                db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)) -> models.FormStep:
    version = _get_form_version(form_id, db, current_user)
    step = db.query(models.FormStep).filter(
        models.FormStep.id == step_id,
        models.FormStep.form_version_id == version.id,
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    for k, v in step_in.model_dump(exclude_unset=True).items():
        setattr(step, k, v)
    db.commit()
    db.refresh(step)
    return step


@router.delete("/forms/{form_id}/steps/{step_id}", status_code=200)
def delete_step(form_id: int, step_id: int, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)) -> dict:
    version = _get_form_version(form_id, db, current_user)
    step = db.query(models.FormStep).filter(
        models.FormStep.id == step_id,
        models.FormStep.form_version_id == version.id,
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    # Un-assign fields from this step
    db.query(models.FormField).filter(models.FormField.step_id == step_id).update({"step_id": None})
    db.delete(step)
    db.commit()
    return {"message": "Step deleted"}


@router.post("/forms/{form_id}/steps/{step_id}/assign-field/{field_id}", response_model=schemas.FormFieldOut)
def assign_field_to_step(form_id: int, step_id: int, field_id: int,
                         db: Session = Depends(get_db),
                         current_user: models.User = Depends(get_current_user)) -> models.FormField:
    """Assign a field to a step (or pass step_id=0 to unassign)."""
    version = _get_form_version(form_id, db, current_user)
    field = db.query(models.FormField).filter(
        models.FormField.id == field_id,
        models.FormField.form_version_id == version.id,
    ).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    if step_id == 0:
        field.step_id = None
    else:
        step = db.query(models.FormStep).filter(
            models.FormStep.id == step_id,
            models.FormStep.form_version_id == version.id,
        ).first()
        if not step:
            raise HTTPException(status_code=404, detail="Step not found")
        field.step_id = step_id
    db.commit()
    db.refresh(field)
    return field
