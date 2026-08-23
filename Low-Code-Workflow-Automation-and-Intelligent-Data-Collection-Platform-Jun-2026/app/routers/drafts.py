from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user
from .schedules import apply_schedule

router = APIRouter()


def _draft_or_404(draft_id: int, user: models.User, db: Session) -> models.DraftSubmission:
    draft = db.query(models.DraftSubmission).filter(
        models.DraftSubmission.id == draft_id,
        models.DraftSubmission.user_id == user.id,
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft


def _answers_payload(answers: list[schemas.SubmissionAnswerCreate]) -> list[dict]:
    return [answer.model_dump() for answer in answers]


@router.post("/", response_model=schemas.DraftSubmissionOut, status_code=status.HTTP_201_CREATED)
def save_draft(
    draft_in: schemas.DraftSubmissionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.DraftSubmission:
    form = db.query(models.Form).filter(models.Form.id == draft_in.form_id).first()
    if not form or not form.current_version_id:
        raise HTTPException(status_code=404, detail="Form or current form version not found")
    # A draft is allowed for a form owner, or for a form currently open to respondents.
    if form.owner_id != current_user.id and not apply_schedule(form, db):
        raise HTTPException(status_code=404, detail="Form is not accepting responses")
    # There is one resumable draft per user and form.  Repeated automatic saves
    # update it instead of creating duplicate drafts.
    draft = db.query(models.DraftSubmission).filter(
        models.DraftSubmission.form_id == form.id,
        models.DraftSubmission.user_id == current_user.id,
    ).first()
    if draft:
        draft.form_version_id = form.current_version_id
        draft.answers = _answers_payload(draft_in.answers)
    else:
        draft = models.DraftSubmission(
            form_id=form.id,
            form_version_id=form.current_version_id,
            user_id=current_user.id,
            answers=_answers_payload(draft_in.answers),
        )
        db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


@router.get("/", response_model=List[schemas.DraftSubmissionOut])
def list_drafts(
    form_id: int | None = None,
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
) -> List[models.DraftSubmission]:
    query = db.query(models.DraftSubmission).filter(
        models.DraftSubmission.user_id == current_user.id
    )
    if form_id is not None:
        query = query.filter(models.DraftSubmission.form_id == form_id)
    return query.order_by(models.DraftSubmission.updated_at.desc()).all()


@router.get("/form/{form_id}", response_model=schemas.DraftSubmissionOut)
def get_draft_by_form(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.DraftSubmission:
    draft = db.query(models.DraftSubmission).filter(
        models.DraftSubmission.form_id == form_id,
        models.DraftSubmission.user_id == current_user.id,
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="No active draft found for this form")
    return draft


@router.get("/{draft_id}", response_model=schemas.DraftSubmissionOut)
def get_draft(draft_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)) -> models.DraftSubmission:
    return _draft_or_404(draft_id, current_user, db)


@router.put("/{draft_id}", response_model=schemas.DraftSubmissionOut)
def update_draft(
    draft_id: int, draft_in: schemas.DraftSubmissionUpdate,
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
) -> models.DraftSubmission:
    draft = _draft_or_404(draft_id, current_user, db)
    draft.answers = _answers_payload(draft_in.answers)
    db.commit()
    db.refresh(draft)
    return draft


@router.delete("/{draft_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_draft(draft_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)) -> None:
    db.delete(_draft_or_404(draft_id, current_user, db))
    db.commit()
