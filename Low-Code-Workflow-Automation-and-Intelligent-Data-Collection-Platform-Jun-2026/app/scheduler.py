from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from .database import SessionLocal
from . import models
from .routers.schedules import apply_schedule

_scheduler = None


def _run_schedules_once() -> None:
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        # Query forms that have schedules
        schedules = db.query(models.FormSchedule).all()
        for sched in schedules:
            form = db.query(models.Form).filter(models.Form.id == sched.form_id).first()
            if not form:
                continue
            try:
                apply_schedule(form, db, now)
            except Exception:
                continue
    finally:
        db.close()


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    _scheduler = BackgroundScheduler()
    # Run every minute
    _scheduler.add_job(_run_schedules_once, 'interval', minutes=1, id='apply_schedules')
    _scheduler.start()
    return _scheduler


def stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
