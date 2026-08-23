from __future__ import annotations

from typing import Any
from .celery_app import celery_app
from .database import SessionLocal
from . import models, schemas
from .routers import translations as translations_module


@celery_app.task(name="app.tasks.generate_translations")
def generate_translations_task(form_id: int) -> dict:
    """Background task: generate translations for a form and persist them.

    Uses same helpers in app.routers.translations. Designed to run in a worker process.
    """
    db = SessionLocal()
    try:
        form = db.query(models.Form).filter(models.Form.id == form_id).first()
        if not form:
            return {"status": "missing", "form_id": form_id}

        fields = translations_module._get_form_fields(form, db)
        en_t = db.query(models.FormTranslation).filter(
            models.FormTranslation.form_id == form.id,
            models.FormTranslation.language_code == "en",
        ).first()
        source = en_t.content if en_t and isinstance(en_t.content, dict) else translations_module._build_source_content(form, fields)

        results = {"form_id": form_id, "translations": []}
        for lang in schemas.SUPPORTED_LANGUAGES:
            if lang == "en":
                existing_en = db.query(models.FormTranslation).filter(
                    models.FormTranslation.form_id == form.id,
                    models.FormTranslation.language_code == "en",
                ).first()
                if not existing_en:
                    db.add(models.FormTranslation(
                        form_id=form.id,
                        language_code="en",
                        is_default=(form.default_language or "en") == "en",
                        content=source,
                    ))
                    db.commit()
                continue

            try:
                translated_content = translations_module._auto_translate_content(source, lang)
            except Exception:
                continue

            existing = db.query(models.FormTranslation).filter(
                models.FormTranslation.form_id == form.id,
                models.FormTranslation.language_code == lang,
            ).first()
            if existing:
                existing.content = translated_content
                db.commit()
                results["translations"].append({"lang": lang, "updated": True})
            else:
                new_t = models.FormTranslation(
                    form_id=form.id,
                    language_code=lang,
                    is_default=(lang == (form.default_language or "en")),
                    content=translated_content,
                )
                db.add(new_t)
                db.commit()
                results["translations"].append({"lang": lang, "created": True})

        return results
    finally:
        db.close()
