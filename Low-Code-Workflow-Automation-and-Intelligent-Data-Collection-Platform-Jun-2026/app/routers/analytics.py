from __future__ import annotations

import csv
import json
from datetime import datetime, timedelta
from io import BytesIO, StringIO
from typing import Any, Dict, List, Optional

from fpdf import FPDF
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter()


def _get_form_or_404(form_id: int, db: Session, current_user: models.User) -> models.Form:
    form = db.query(models.Form).filter(models.Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    if form.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return form


def _start_of_period(period: str) -> datetime:
    now = datetime.utcnow()
    if period == "today":
        return datetime(now.year, now.month, now.day)
    if period == "week":
        start = now - timedelta(days=now.weekday())
        return datetime(start.year, start.month, start.day)
    if period == "month":
        return datetime(now.year, now.month, 1)
    if period == "year":
        return datetime(now.year, 1, 1)
    raise ValueError("Invalid period")


def _serialize_answer_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    try:
        return str(value)
    except Exception:
        return None


def _to_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str) and value.isdigit():
        return int(value)
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


def _count_by_weekday(submissions: List[models.FormSubmission]) -> Dict[str, int]:
    counts: Dict[str, int] = {
        "Monday": 0,
        "Tuesday": 0,
        "Wednesday": 0,
        "Thursday": 0,
        "Friday": 0,
        "Saturday": 0,
        "Sunday": 0,
    }
    for submission in submissions:
        if submission.submitted_at:
            weekday = submission.submitted_at.weekday()
            day_name = list(counts.keys())[weekday]
            counts[day_name] += 1
    return counts


def _build_time_series(days: int, submissions: List[models.FormSubmission]) -> List[schemas.TimeSeriesPoint]:
    today = datetime.utcnow().date()
    date_counts: Dict[str, int] = {}
    for offset in range(days):
        date_key = (today - timedelta(days=offset)).isoformat()
        date_counts[date_key] = 0

    for submission in submissions:
        if submission.submitted_at:
            submitted_date = submission.submitted_at.date().isoformat()
            if submitted_date in date_counts:
                date_counts[submitted_date] += 1

    return [schemas.TimeSeriesPoint(label=date_key, count=date_counts[date_key]) for date_key in sorted(date_counts.keys())]


def _build_month_series(months: int, submissions: List[models.FormSubmission]) -> List[schemas.TimeSeriesPoint]:
    today = datetime.utcnow()
    month_counts: Dict[str, int] = {}
    for offset in range(months):
        month = today.month - offset
        year = today.year
        while month <= 0:
            month += 12
            year -= 1
        label = f"{year:04d}-{month:02d}"
        month_counts[label] = 0

    for submission in submissions:
        if submission.submitted_at:
            label = f"{submission.submitted_at.year:04d}-{submission.submitted_at.month:02d}"
            if label in month_counts:
                month_counts[label] += 1

    return [schemas.TimeSeriesPoint(label=label, count=month_counts[label]) for label in sorted(month_counts.keys())]


def _get_dashboard_stats(db: Session, current_user: models.User) -> schemas.DashboardAnalytics:
    total_forms = (
        db.query(func.count(models.Form.id))
        .filter(models.Form.owner_id == current_user.id)
        .scalar() or 0
    )
    published_forms = (
        db.query(func.count(models.Form.id))
        .filter(models.Form.owner_id == current_user.id)
        .filter(models.Form.status == "published")
        .scalar() or 0
    )
    draft_forms = (
        db.query(func.count(models.Form.id))
        .filter(models.Form.owner_id == current_user.id)
        .filter(models.Form.status == "draft")
        .scalar() or 0
    )
    archived_forms = (
        db.query(func.count(models.Form.id))
        .filter(models.Form.owner_id == current_user.id)
        .filter(models.Form.status == "archived")
        .scalar() or 0
    )
    total_users = 1
    total_submissions = (
        db.query(func.count(models.FormSubmission.id))
        .join(models.Form, models.FormSubmission.form_id == models.Form.id)
        .filter(models.Form.owner_id == current_user.id)
        .scalar() or 0
    )
    completed_responses = total_submissions

    return schemas.DashboardAnalytics(
        total_forms=total_forms,
        published_forms=published_forms,
        draft_forms=draft_forms,
        archived_forms=archived_forms,
        total_users=total_users,
        total_submissions=total_submissions,
        completed_responses=completed_responses,
    )


def _get_form_submission_count(form_id: int, db: Session) -> int:
    return (
        db.query(func.count(models.FormSubmission.id))
        .filter(models.FormSubmission.form_id == form_id)
        .scalar() or 0
    )


def _get_submission_range_count(form_id: int, db: Session, since: datetime) -> int:
    return (
        db.query(func.count(models.FormSubmission.id))
        .filter(models.FormSubmission.form_id == form_id)
        .filter(models.FormSubmission.submitted_at >= since)
        .scalar() or 0
    )


def _get_field_statistics(form_id: int, db: Session) -> List[schemas.FieldStatistic]:
    results = (
        db.query(
            models.FormField.id,
            models.FormField.field_name,
            models.FormField.field_type,
            models.SubmissionAnswer.answer_value,
            func.count(models.SubmissionAnswer.id),
        )
        .join(models.SubmissionAnswer, models.SubmissionAnswer.form_field_id == models.FormField.id)
        .join(models.FormSubmission, models.FormSubmission.id == models.SubmissionAnswer.submission_id)
        .filter(models.FormSubmission.form_id == form_id)
        .group_by(
            models.FormField.id,
            models.FormField.field_name,
            models.FormField.field_type,
            models.SubmissionAnswer.answer_value,
        )
        .all()
    )

    stats: List[schemas.FieldStatistic] = []
    for field_id, field_name, field_type, answer_value, count in results:
        stats.append(
            schemas.FieldStatistic(
                field_id=field_id,
                field_name=field_name,
                field_type=field_type,
                answer_value=_serialize_answer_value(answer_value),
                count=count,
            )
        )
    return stats


def _get_rating_field_ids(form_id: int, db: Session) -> set[int]:
    fields = (
        db.query(models.FormField.id)
        .join(models.FormVersion, models.FormField.form_version_id == models.FormVersion.id)
        .filter(models.FormVersion.form_id == form_id)
        .filter(
            or_(
                models.FormField.field_type.ilike("%rating%"),
                models.FormField.field_name.ilike("%rating%"),
                models.FormField.label.ilike("%rating%"),
            )
        )
        .all()
    )
    return {field_id for (field_id,) in fields}


def _get_rating_statistics(form_id: int, db: Session) -> List[schemas.RatingStatistic]:
    rating_counts: Dict[int, int] = {rating: 0 for rating in range(1, 6)}
    rating_field_ids = _get_rating_field_ids(form_id, db)

    answers = (
        db.query(
            models.SubmissionAnswer.answer_value,
            models.SubmissionAnswer.answer_json,
            models.SubmissionAnswer.form_field_id,
        )
        .join(models.FormSubmission, models.FormSubmission.id == models.SubmissionAnswer.submission_id)
        .filter(models.FormSubmission.form_id == form_id)
        .all()
    )

    for answer_value, answer_json, field_id in answers:
        raw_value = answer_value if answer_value is not None else answer_json
        rating = _to_int(raw_value)
        if rating is None:
            continue
        if 1 <= rating <= 5:
            if rating_field_ids and field_id not in rating_field_ids:
                continue
            rating_counts[rating] += 1

    return [schemas.RatingStatistic(rating=rating, count=count) for rating, count in rating_counts.items() if count > 0]


def _calculate_average_rating(form_id: int, db: Session) -> Optional[float]:
    rating_values: List[int] = []
    rating_field_ids = _get_rating_field_ids(form_id, db)

    answers = (
        db.query(
            models.SubmissionAnswer.answer_value,
            models.SubmissionAnswer.answer_json,
            models.SubmissionAnswer.form_field_id,
        )
        .join(models.FormSubmission, models.FormSubmission.id == models.SubmissionAnswer.submission_id)
        .filter(models.FormSubmission.form_id == form_id)
        .all()
    )

    for answer_value, answer_json, field_id in answers:
        raw_value = answer_value if answer_value is not None else answer_json
        if rating_field_ids and field_id not in rating_field_ids:
            continue
        rating = _to_int(raw_value)
        if rating is None or rating < 1 or rating > 5:
            continue
        rating_values.append(rating)

    if not rating_values:
        return None
    return round(sum(rating_values) / len(rating_values), 2)


@router.get("/dashboard", response_model=schemas.DashboardAnalytics, tags=["Analytics"])
def get_dashboard_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.DashboardAnalytics:
    return _get_dashboard_stats(db, current_user)


@router.get("/form/{form_id}", response_model=schemas.FormAnalytics, tags=["Analytics"])
def get_form_analytics(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.FormAnalytics:
    form = _get_form_or_404(form_id, db, current_user)
    submission_count = _get_form_submission_count(form_id, db)
    completion_rate = 100.0 if submission_count > 0 else 0.0
    average_rating = _calculate_average_rating(form_id, db)
    return schemas.FormAnalytics(
        form_id=form.id,
        title=form.title,
        submission_count=submission_count,
        completion_rate=completion_rate,
        average_rating=average_rating,
        field_statistics=_get_field_statistics(form_id, db),
        rating_statistics=_get_rating_statistics(form_id, db),
    )


@router.get("/submission/{form_id}", response_model=schemas.SubmissionAnalytics, tags=["Analytics"])
def get_submission_analytics(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.SubmissionAnalytics:
    form = _get_form_or_404(form_id, db, current_user)
    total_submissions = _get_form_submission_count(form_id, db)
    today = _get_submission_range_count(form_id, db, _start_of_period("today"))
    this_week = _get_submission_range_count(form_id, db, _start_of_period("week"))
    this_month = _get_submission_range_count(form_id, db, _start_of_period("month"))
    this_year = _get_submission_range_count(form_id, db, _start_of_period("year"))

    recent_submissions = (
        db.query(models.FormSubmission)
        .filter(models.FormSubmission.form_id == form_id)
        .filter(models.FormSubmission.submitted_at >= datetime.utcnow() - timedelta(days=30))
        .all()
    )

    return schemas.SubmissionAnalytics(
        form_id=form.id,
        title=form.title,
        total_submissions=total_submissions,
        completed_responses=total_submissions,
        today=today,
        this_week=this_week,
        this_month=this_month,
        this_year=this_year,
        daily_submissions=_build_time_series(7, recent_submissions),
        monthly_submissions=_build_month_series(6, recent_submissions),
    )


@router.get("/trends", response_model=schemas.TrendsAnalytics, tags=["Analytics"])
def get_trends_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.TrendsAnalytics:
    submissions = (
        db.query(models.FormSubmission)
        .join(models.Form, models.Form.id == models.FormSubmission.form_id)
        .filter(models.Form.owner_id == current_user.id)
        .all()
    )
    weekday_counts = _count_by_weekday(submissions)
    trending_day = max(weekday_counts, key=weekday_counts.get) if submissions else "N/A"

    most_submitted = (
        db.query(models.Form.id, models.Form.title, func.count(models.FormSubmission.id).label("count"))
        .join(models.FormSubmission, models.FormSubmission.form_id == models.Form.id)
        .filter(models.Form.owner_id == current_user.id)
        .group_by(models.Form.id)
        .order_by(func.count(models.FormSubmission.id).desc())
        .limit(1)
        .first()
    )
    
    most_used_field = (
        db.query(models.FormField.id, models.FormField.field_name, func.count(models.SubmissionAnswer.id).label("count"))
        .join(models.SubmissionAnswer, models.SubmissionAnswer.form_field_id == models.FormField.id)
        .join(models.FormVersion, models.FormField.form_version_id == models.FormVersion.id)
        .join(models.Form, models.FormVersion.form_id == models.Form.id)
        .filter(models.Form.owner_id == current_user.id)
        .group_by(models.FormField.id)
        .order_by(func.count(models.SubmissionAnswer.id).desc())
        .limit(1)
        .first()
    )
    
    most_selected_option = (
        db.query(models.SubmissionAnswer.form_field_id, models.FormField.field_name, models.SubmissionAnswer.answer_value, func.count(models.SubmissionAnswer.id).label("count"))
        .join(models.FormField, models.SubmissionAnswer.form_field_id == models.FormField.id)
        .join(models.FormVersion, models.FormField.form_version_id == models.FormVersion.id)
        .join(models.Form, models.FormVersion.form_id == models.Form.id)
        .filter(models.SubmissionAnswer.answer_value.isnot(None))
        .filter(models.Form.owner_id == current_user.id)
        .group_by(models.SubmissionAnswer.form_field_id, models.FormField.field_name, models.SubmissionAnswer.answer_value)
        .order_by(func.count(models.SubmissionAnswer.id).desc())
        .limit(1)
        .first()
    )

    most_submitted_form = None
    if most_submitted:
        most_submitted_form = schemas.TrendMetric(
            id=most_submitted.id,
            name=most_submitted.title,
            count=most_submitted.count,
        )

    most_used_field_metric = None
    if most_used_field:
        most_used_field_metric = schemas.TrendMetric(
            id=most_used_field.id,
            name=most_used_field.field_name,
            count=most_used_field.count,
        )

    most_selected_option_metric = None
    if most_selected_option:
        most_selected_option_metric = schemas.TrendMetric(
            id=most_selected_option.form_field_id,
            name=f"{most_selected_option.field_name} → {_serialize_answer_value(most_selected_option.answer_value)}",
            count=most_selected_option.count,
        )

    return schemas.TrendsAnalytics(
        trending_day=trending_day,
        most_submitted_form=most_submitted_form,
        most_used_field=most_used_field_metric,
        most_selected_option=most_selected_option_metric,
    )


@router.get("/export/json", tags=["Analytics"])
def export_analytics_json(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Response:
    payload = {
        "dashboard": _get_dashboard_stats(db, current_user).model_dump(),
        "trends": get_trends_analytics(db, current_user).model_dump(),
    }
    return Response(
        content=json.dumps(payload, default=str),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=analytics.json"},
    )


@router.get("/export/csv", tags=["Analytics"])
def export_analytics_csv(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Response:
    dashboard = _get_dashboard_stats(db, current_user).model_dump()
    trends = get_trends_analytics(db, current_user).model_dump()

    buffer = StringIO()
    writer = csv.writer(buffer)

    writer.writerow(["Dashboard"])
    for key, value in dashboard.items():
        writer.writerow([key, value])

    writer.writerow([])
    writer.writerow(["Trends"])
    writer.writerow(["Trending Day", trends.get("trending_day")])

    most_submitted = trends.get("most_submitted_form")
    if most_submitted:
        writer.writerow(["Most Submitted Form", most_submitted.get("name"), most_submitted.get("count")])
    most_used_field = trends.get("most_used_field")
    if most_used_field:
        writer.writerow(["Most Used Field", most_used_field.get("name"), most_used_field.get("count")])
    most_selected_option = trends.get("most_selected_option")
    if most_selected_option:
        writer.writerow(["Most Selected Option", most_selected_option.get("name"), most_selected_option.get("count")])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=analytics.csv"},
    )


@router.get("/export/pdf", tags=["Analytics"])
def export_analytics_pdf(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> StreamingResponse:
    dashboard = _get_dashboard_stats(db, current_user).model_dump()
    trends = get_trends_analytics(db, current_user).model_dump()

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", "B", 16)
    pdf.cell(0, 10, "Analytics Export", ln=True)
    pdf.ln(4)

    pdf.set_font("Arial", "B", 12)
    pdf.cell(0, 8, "Dashboard", ln=True)
    pdf.set_font("Arial", size=11)
    for key, value in dashboard.items():
        pdf.cell(0, 7, f"{key.replace('_', ' ').title()}: {value}", ln=True)

    pdf.ln(4)
    pdf.set_font("Arial", "B", 12)
    pdf.cell(0, 8, "Trends", ln=True)
    pdf.set_font("Arial", size=11)
    pdf.cell(0, 7, f"Trending Day: {trends.get('trending_day')}", ln=True)
    for metric_name in ("most_submitted_form", "most_used_field", "most_selected_option"):
        metric = trends.get(metric_name)
        if metric:
            pdf.cell(0, 7, f"{metric_name.replace('_', ' ').title()}: {metric.get('name')} ({metric.get('count')})", ln=True)

    pdf_bytes = pdf.output(dest="S").encode("latin-1")
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=analytics.pdf"},
    )


# ── Enhanced dashboard endpoint ────────────────────────────────────────────────

@router.get("/enhanced-dashboard", response_model=schemas.EnhancedDashboardAnalytics, tags=["Analytics"])
def get_enhanced_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.EnhancedDashboardAnalytics:
    """Enhanced dashboard stats with public/private breakdown, top forms, field types, trends."""
    base = _get_dashboard_stats(db, current_user)
 
    public_forms = (
        db.query(func.count(models.Form.id))
        .filter(models.Form.owner_id == current_user.id)
        .filter(models.Form.is_public == True)
        .scalar() or 0
    )
    private_forms = (
        db.query(func.count(models.Form.id))
        .filter(models.Form.owner_id == current_user.id)
        .filter(models.Form.is_public == False)
        .scalar() or 0
    )

    # Top 5 forms by submission count
    top_raw = (
        db.query(models.Form.id, models.Form.title, models.Form.status,
                 func.count(models.FormSubmission.id).label("cnt"))
        .outerjoin(models.FormSubmission, models.FormSubmission.form_id == models.Form.id)
        .filter(models.Form.owner_id == current_user.id)
        .group_by(models.Form.id)
        .order_by(func.count(models.FormSubmission.id).desc())
        .limit(5)
        .all()
    )
    top_forms = [
        schemas.TopFormMetric(form_id=r.id, title=r.title, submission_count=r.cnt, status=r.status)
        for r in top_raw
    ]

    # Field type breakdown
    ft_raw = (
        db.query(models.FormField.field_type, func.count(models.FormField.id).label("cnt"))
        .join(models.FormVersion, models.FormField.form_version_id == models.FormVersion.id)
        .join(models.Form, models.FormVersion.form_id == models.Form.id)
        .filter(models.Form.owner_id == current_user.id)
        .group_by(models.FormField.field_type)
        .order_by(func.count(models.FormField.id).desc())
        .all()
    )
    field_type_breakdown = [
        schemas.FieldTypeBreakdown(field_type=r.field_type, count=r.cnt)
        for r in ft_raw
    ]

    # Submissions last 30 days
    recent_subs = (
        db.query(models.FormSubmission)
        .join(models.Form, models.Form.id == models.FormSubmission.form_id)
        .filter(models.Form.owner_id == current_user.id)
        .filter(models.FormSubmission.submitted_at >= datetime.utcnow() - timedelta(days=30))
        .all()
    )
    submissions_30 = _build_time_series(30, recent_subs)

    return schemas.EnhancedDashboardAnalytics(
        total_forms=base.total_forms,
        published_forms=base.published_forms,
        draft_forms=base.draft_forms,
        archived_forms=base.archived_forms,
        total_users=base.total_users,
        total_submissions=base.total_submissions,
        completed_responses=base.completed_responses,
        public_forms=public_forms,
        private_forms=private_forms,
        top_forms=top_forms,
        field_type_breakdown=field_type_breakdown,
        submissions_last_30_days=submissions_30,
    )
