from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter()


def _to_utc_naive_input(d: datetime | None) -> datetime | None:
    """Convert a datetime from incoming input to naive UTC.

    - If d is timezone-aware -> convert to UTC and drop tzinfo
    - If d is naive -> treat it as local time, convert to UTC, and drop tzinfo
    """
    if d is None:
        return None
    if getattr(d, 'tzinfo', None) is not None:
        return d.astimezone(timezone.utc).replace(tzinfo=None)
    local_tz = datetime.now().astimezone().tzinfo
    if local_tz is None:
        local_tz = timezone.utc
    return d.replace(tzinfo=local_tz).astimezone(timezone.utc).replace(tzinfo=None)


def _to_utc_naive_db(d: datetime | None) -> datetime | None:
    """Normalize stored DB datetimes to naive UTC.

    - If d is timezone-aware -> convert to UTC and drop tzinfo
    - If d is naive -> assume it is already UTC and return it unchanged
    """
    if d is None:
        return None
    if getattr(d, 'tzinfo', None) is not None:
        return d.astimezone(timezone.utc).replace(tzinfo=None)
    return d


def apply_schedule(form: models.Form, db: Session, now: datetime | None = None) -> bool:
    """
    Apply a schedule when a form is accessed; returns whether it is available.
    Logic:
      - No schedule → return form.is_published (respect manual publish state)
      - Schedule exists, before starts_at → not available (upcoming)
      - Schedule exists, after ends_at → archive and return False
      - Schedule exists, within window → auto-publish if needed and return True
    """
    schedule = db.query(models.FormSchedule).filter(models.FormSchedule.form_id == form.id).first()
    if not schedule:
        return form.is_published
    now = (now or datetime.utcnow()).replace(tzinfo=None)

    starts = _to_utc_naive_db(schedule.starts_at)
    ends   = _to_utc_naive_db(schedule.ends_at)

    if starts and now < starts:
        if form.is_published:
            form.is_published = False
            form.status = "draft"
            form.updated_at = now
            db.commit()
        return False

    if ends and now >= ends:
        if schedule.auto_archive and form.status != "archived":
            form.is_published = False
            form.status = "archived"
            form.updated_at = now
            db.commit()
        return False

    if schedule.auto_publish and not form.is_published:
        form.is_published = True
        form.status = "published"
        form.updated_at = now
        db.commit()

    return form.is_published


def _owned_form(form_id: int, user: models.User, db: Session) -> models.Form:
    form = db.query(models.Form).filter(models.Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if form.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to manage this form schedule")
    return form


def _validate_window(starts_at: datetime | None, ends_at: datetime | None) -> None:
    # Normalize both to naive UTC before comparing
    def _to_utc_for_validation(d: datetime | None) -> datetime | None:
        if d is None:
            return None
        if getattr(d, 'tzinfo', None) is not None:
            return d.astimezone(timezone.utc).replace(tzinfo=None)
        return d

    s = _to_utc_for_validation(starts_at)
    e = _to_utc_for_validation(ends_at)
    if s and e and s >= e:
        raise HTTPException(status_code=422, detail="starts_at must be before ends_at")


def _schedule_or_404(schedule_id: int, user: models.User, db: Session) -> models.FormSchedule:
    schedule = db.query(models.FormSchedule).filter(models.FormSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    _owned_form(schedule.form_id, user, db)
    return schedule


@router.post("/", response_model=schemas.FormScheduleOut, status_code=status.HTTP_201_CREATED)
def create_schedule(
    schedule_in: schemas.FormScheduleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.FormSchedule:
    _validate_window(schedule_in.starts_at, schedule_in.ends_at)
    form = _owned_form(schedule_in.form_id, current_user, db)
    if db.query(models.FormSchedule).filter(models.FormSchedule.form_id == form.id).first():
        raise HTTPException(status_code=409, detail="A schedule already exists for this form. Edit the existing one.")

    schedule = models.FormSchedule(
        form_id=schedule_in.form_id,
        starts_at=schedule_in.starts_at,
        ends_at=schedule_in.ends_at,
        auto_publish=schedule_in.auto_publish,
        auto_archive=schedule_in.auto_archive,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(schedule)

    now = datetime.utcnow().replace(tzinfo=None)

    # Convert incoming datetimes to naive UTC for comparison (DB stores naive UTC)
    starts = _to_utc_naive_input(schedule_in.starts_at)
    ends = _to_utc_naive_input(schedule_in.ends_at)

    if starts and starts > now:
        form.is_published = False
        form.status = "draft"
        form.updated_at = now
    elif ends and ends <= now:
        if schedule_in.auto_archive:
            form.is_published = False
            form.status = "archived"
            form.updated_at = now
    else:
        if schedule_in.auto_publish and not form.is_published:
            form.is_published = True
            form.status = "published"
            form.updated_at = now

    # Store as naive UTC in DB
    schedule.starts_at = starts
    schedule.ends_at = ends

    db.commit()
    db.refresh(schedule)
    return schedule


@router.get("/", response_model=List[schemas.FormScheduleOut])
def list_schedules(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)) -> List[models.FormSchedule]:
    return (
        db.query(models.FormSchedule)
        .join(models.Form)
        .filter(models.Form.owner_id == current_user.id)
        .order_by(models.FormSchedule.starts_at)
        .all()
    )


# NOTE: /upcoming MUST be defined before /{schedule_id} so FastAPI doesn't
# try to cast the string "upcoming" as an integer path parameter.
@router.get("/upcoming", response_model=List[schemas.UpcomingFormOut], tags=["Form Scheduling"])
def list_upcoming_forms(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list:
    """
    Return upcoming scheduled forms for the current user context.
    Admins only see their own forms; registered users see all available upcoming forms.
    """
    now = datetime.utcnow()

    schedule_query = (
        db.query(models.FormSchedule)
        .join(models.Form)
        .filter(models.FormSchedule.starts_at > now)
        .filter(models.Form.status != 'archived')
    )

    if current_user.is_superuser:
        schedule_query = schedule_query.filter(models.Form.owner_id == current_user.id)

    schedules = schedule_query.order_by(models.FormSchedule.starts_at).all()

    result = []
    for schedule in schedules:
        form = db.query(models.Form).filter(models.Form.id == schedule.form_id).first()
        if not form:
            continue

        if current_user.is_superuser and form.owner_id != current_user.id:
            continue

        result.append(schemas.UpcomingFormOut(
            id=form.id,
            title=form.title,
            description=form.description,
            uuid=form.uuid,
            starts_at=schedule.starts_at,
            ends_at=schedule.ends_at,
            is_public=form.is_public,
        ))
    return result


@router.get("/{schedule_id}", response_model=schemas.FormScheduleOut)
def get_schedule(schedule_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)) -> models.FormSchedule:
    return _schedule_or_404(schedule_id, current_user, db)


@router.put("/{schedule_id}", response_model=schemas.FormScheduleOut)
def update_schedule(
    schedule_id: int,
    schedule_in: schemas.FormScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.FormSchedule:
    schedule = _schedule_or_404(schedule_id, current_user, db)
    changes = schedule_in.model_dump(exclude_unset=True)

    # Convert incoming changed datetimes to naive UTC for DB storage
    if 'starts_at' in changes:
        changes['starts_at'] = _to_utc_naive_input(changes['starts_at'])
    if 'ends_at' in changes:
        changes['ends_at'] = _to_utc_naive_input(changes['ends_at'])

    # Get the effective window after applying changes
    starts_at = changes.get("starts_at", schedule.starts_at)
    ends_at   = changes.get("ends_at",   schedule.ends_at)
    _validate_window(starts_at, ends_at)

    for key, value in changes.items():
        setattr(schedule, key, value)

    # Re-evaluate form status based on new window
    form = db.query(models.Form).filter(models.Form.id == schedule.form_id).first()
    if form:
        now = datetime.utcnow().replace(tzinfo=None)

        s_at = _to_utc_naive_db(starts_at)
        e_at = _to_utc_naive_db(ends_at)

        if s_at and s_at > now:
            form.is_published = False
            form.status = "draft"
            form.updated_at = now
        elif e_at and e_at <= now:
            if schedule.auto_archive:
                form.is_published = False
                form.status = "archived"
                form.updated_at = now
        else:
            if schedule.auto_publish and not form.is_published:
                form.is_published = True
                form.status = "published"
                form.updated_at = now

    db.commit()
    db.refresh(schedule)
    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_schedule(schedule_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)) -> None:
    db.delete(_schedule_or_404(schedule_id, current_user, db))
    db.commit()
