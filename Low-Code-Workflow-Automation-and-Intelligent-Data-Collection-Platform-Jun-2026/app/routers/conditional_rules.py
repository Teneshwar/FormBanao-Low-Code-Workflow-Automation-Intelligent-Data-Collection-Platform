from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter()


def _log(db, action, user_id, resource_id=None, ip=None):
    db.add(models.AuditLog(
        user_id=user_id, action=action,
        resource_type="conditional_rule", resource_id=resource_id, ip_address=ip,
    ))


def _get_form_and_assert_owner(form_id: int, user: models.User, db: Session) -> models.Form:
    form = db.query(models.Form).filter(models.Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if form.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return form


def _get_rule_or_404(rule_id: int, db: Session) -> models.ConditionalRule:
    rule = db.query(models.ConditionalRule).filter(models.ConditionalRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Conditional rule not found")
    return rule


def _assert_rule_owner(rule: models.ConditionalRule, user: models.User, db: Session) -> None:
    version = db.query(models.FormVersion).filter(
        models.FormVersion.id == rule.form_version_id
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    form = db.query(models.Form).filter(models.Form.id == version.form_id).first()
    if not form or form.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")


@router.post(
    "/forms/{form_id}/conditional-rules",
    response_model=schemas.ConditionalRuleOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Conditional Rules"],
)
def create_rule(
    form_id: int,
    rule_in: schemas.ConditionalRuleCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.ConditionalRule:
    form = _get_form_and_assert_owner(form_id, current_user, db)
    if not form.current_version_id:
        raise HTTPException(status_code=400, detail="Form has no current version")

    rule = models.ConditionalRule(
        form_version_id=form.current_version_id,
        trigger_field_id=rule_in.trigger_field_id,
        operator=rule_in.operator,
        trigger_value=rule_in.trigger_value,
        target_field_id=rule_in.target_field_id,
        action=rule_in.action,
    )
    db.add(rule)
    db.flush()
    _log(db, "rule.created", current_user.id, resource_id=rule.id,
         ip=request.client.host if request.client else None)
    db.commit()
    db.refresh(rule)
    return rule


@router.get(
    "/forms/{form_id}/conditional-rules",
    response_model=List[schemas.ConditionalRuleOut],
    tags=["Conditional Rules"],
)
def list_rules(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.ConditionalRule]:
    form = _get_form_and_assert_owner(form_id, current_user, db)
    if not form.current_version_id:
        return []
    return (
        db.query(models.ConditionalRule)
        .filter(models.ConditionalRule.form_version_id == form.current_version_id)
        .all()
    )


@router.get(
    "/conditional-rules/{rule_id}",
    response_model=schemas.ConditionalRuleOut,
    tags=["Conditional Rules"],
)
def get_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.ConditionalRule:
    rule = _get_rule_or_404(rule_id, db)
    _assert_rule_owner(rule, current_user, db)
    return rule


@router.patch(
    "/conditional-rules/{rule_id}",
    response_model=schemas.ConditionalRuleOut,
    tags=["Conditional Rules"],
)
def patch_rule(
    rule_id: int,
    rule_in: schemas.ConditionalRuleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.ConditionalRule:
    rule = _get_rule_or_404(rule_id, db)
    _assert_rule_owner(rule, current_user, db)

    for attr, value in rule_in.model_dump(exclude_unset=True).items():
        setattr(rule, attr, value)

    _log(db, "rule.updated", current_user.id, resource_id=rule_id,
         ip=request.client.host if request.client else None)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete(
    "/conditional-rules/{rule_id}",
    status_code=status.HTTP_200_OK,
    tags=["Conditional Rules"],
)
def delete_rule(
    rule_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> None:
    rule = _get_rule_or_404(rule_id, db)
    _assert_rule_owner(rule, current_user, db)
    _log(db, "rule.deleted", current_user.id, resource_id=rule_id,
         ip=request.client.host if request.client else None)
    db.delete(rule)
    db.commit()
