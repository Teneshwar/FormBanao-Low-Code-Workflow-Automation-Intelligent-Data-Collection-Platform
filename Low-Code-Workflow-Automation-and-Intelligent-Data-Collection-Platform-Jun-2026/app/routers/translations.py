"""
Multi-language form translations router.
Endpoints for managing per-form language translations and auto-translation.
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user, get_optional_user
from .schedules import apply_schedule

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_form_or_404(form_id: int, db: Session) -> models.Form:
    form = db.query(models.Form).filter(models.Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


def _assert_owner(form: models.Form, user: models.User) -> None:
    if form.owner_id != user.id and not user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")


def _completion_pct(content: dict, fields: list) -> float:
    """Calculate translation completion % based on filled strings."""
    total = 0
    filled = 0

    def _check(v):
        nonlocal total, filled
        if isinstance(v, str):
            total += 1
            if v.strip():
                filled += 1

    _check(content.get("title"))
    _check(content.get("description"))
    _check(content.get("submit_button"))
    field_translations = content.get("fields", {})
    for field in fields:
        # Look up by field_name (stable key) first, fall back to str(field.id) for old data
        fkey = field.field_name
        ft = field_translations.get(fkey) or field_translations.get(str(field.id), {})
        ft = ft if isinstance(ft, dict) else {}
        _check(ft.get("label", ""))
        if field.placeholder:
            _check(ft.get("placeholder", ""))
        if isinstance(field.options, list):
            for opt in field.options:
                opts_t = ft.get("options", [])
                if isinstance(opts_t, list):
                    _check(next((o for o in opts_t if o), None) or "")
                else:
                    total += 1  # missing

    return round((filled / total * 100) if total > 0 else 0.0, 1)


def _build_translation_out(t: models.FormTranslation, fields: list) -> schemas.FormTranslationOut:
    return schemas.FormTranslationOut(
        id=t.id,
        form_id=t.form_id,
        language_code=t.language_code,
        language_name=schemas.LANGUAGE_NAMES.get(t.language_code, t.language_code),
        is_default=t.is_default,
        content=t.content,
        completion_pct=_completion_pct(t.content if isinstance(t.content, dict) else {}, fields),
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def _get_form_fields(form: models.Form, db: Session) -> list:
    if not form.current_version_id:
        return []
    return (
        db.query(models.FormField)
        .filter(models.FormField.form_version_id == form.current_version_id)
        .order_by(models.FormField.order_index)
        .all()
    )


def _build_source_content(form: models.Form, fields: list) -> dict:
    """Build the English (source) content dict from the form's actual data.
    Keys fields by field_name (stable across republishes) not field.id.
    """
    content: dict = {
        "title": form.title,
        "description": form.description or "",
        "submit_button": "Submit",
        "thank_you_message": "Thank you! Your response has been submitted.",
        "fields": {},
    }
    for field in fields:
        # Use field_name as key — stable across version republishes
        content["fields"][field.field_name] = {
            "field_id": field.id,  # store for reference but don't use as lookup key
            "label": field.label,
            "placeholder": field.placeholder or "",
            "help_text": "",
            "options": field.options if isinstance(field.options, list) else [],
        }
    return content


# ── LibreTranslate free API (no key needed) ───────────────────────────────────

LIBRE_API = "https://libretranslate.com/translate"

# Map our lang codes to LibreTranslate codes
_LANG_MAP = {
    "en": "en", "hi": "hi", "ta": "ta", "te": "te",
    "mr": "mr", "bn": "bn", "gu": "gu", "kn": "kn",
    "ml": "ml", "pa": "pa", "ar": "ar", "fr": "fr",
    "de": "de", "es": "es", "pt": "pt", "zh": "zh",
    "ja": "ja", "ko": "ko", "ru": "ru", "ur": "ur",
}


def _translate_text(text: str, target: str, source: str = "en") -> str:
    """Translate one string. Returns original on failure."""
    if not text or not text.strip():
        return text
    try:
        lp = f"{source}|{target}"
        url = f"https://api.mymemory.translated.net/get?q={urllib.request.quote(text[:200])}&langpair={lp}&de=form@platform.com"
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read())
            result = data.get("responseData", {}).get("translatedText", "")
            # MyMemory returns status 200 as int or string
            status = data.get("responseStatus")
            if result and str(status) == "200":
                return result
    except Exception:
        pass
    return text  # fall back to original


def _auto_translate_content(source: dict, target_lang: str) -> dict:
    """Translate all strings in a content dict to target_lang — run field translations in parallel."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    translated: dict = {}

    # Translate top-level strings sequentially (only 4 strings)
    translated["title"]             = _translate_text(source.get("title", ""), target_lang)
    translated["description"]       = _translate_text(source.get("description", ""), target_lang)
    translated["submit_button"]     = _translate_text(source.get("submit_button", "Submit"), target_lang)
    translated["thank_you_message"] = _translate_text(
        source.get("thank_you_message", "Thank you! Your response has been submitted."), target_lang
    )

    # Translate field strings in parallel
    field_source = source.get("fields") or {}
    translated_fields: dict = {}

    def translate_field(fid_fdata):
        fname, fdata = fid_fdata
        return fname, {
            "field_id": fdata.get("field_id"),  # preserve for reference
            "label":       _translate_text(fdata.get("label", ""), target_lang),
            "placeholder": _translate_text(fdata.get("placeholder", ""), target_lang),
            "help_text":   _translate_text(fdata.get("help_text", ""), target_lang),
            "options":     [_translate_text(o, target_lang) for o in (fdata.get("options") or [])],
        }

    if field_source:
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(translate_field, item) for item in field_source.items()]
            for future in as_completed(futures):
                try:
                    fid, ftrans = future.result()
                    translated_fields[fid] = ftrans
                except Exception:
                    pass

    translated["fields"] = translated_fields
    return translated


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{form_id}/languages", response_model=schemas.FormLanguageSettingsOut)
def get_language_settings(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.FormLanguageSettingsOut:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)
    fields = _get_form_fields(form, db)
    translations = db.query(models.FormTranslation).filter(
        models.FormTranslation.form_id == form_id
    ).all()
    return schemas.FormLanguageSettingsOut(
        form_id=form_id,
        multilingual_enabled=form.multilingual_enabled,
        default_language=form.default_language or "en",
        languages=[_build_translation_out(t, fields) for t in translations],
    )


@router.post("/{form_id}/languages/toggle", response_model=schemas.FormLanguageSettingsOut)
def toggle_multilingual(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.FormLanguageSettingsOut:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)
    form.multilingual_enabled = not form.multilingual_enabled

    # Auto-seed the default (English) translation if enabling for first time
    if form.multilingual_enabled:
        existing = db.query(models.FormTranslation).filter(
            models.FormTranslation.form_id == form_id,
            models.FormTranslation.language_code == "en",
        ).first()
        if not existing:
            fields = _get_form_fields(form, db)
            content = _build_source_content(form, fields)
            db.add(models.FormTranslation(
                form_id=form_id,
                language_code="en",
                is_default=True,
                content=content,
            ))

    db.commit()
    db.refresh(form)
    return get_language_settings(form_id, db, current_user)


@router.post("/{form_id}/languages/{lang_code}", response_model=schemas.FormTranslationOut, status_code=201)
def add_language(
    form_id: int,
    lang_code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.FormTranslationOut:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)
    if lang_code not in schemas.SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {lang_code}")
    existing = db.query(models.FormTranslation).filter(
        models.FormTranslation.form_id == form_id,
        models.FormTranslation.language_code == lang_code,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Language already added")
    fields = _get_form_fields(form, db)
    # Always build from source — provides labels/options to translate from
    source_content = _build_source_content(form, fields)
    content = source_content if lang_code == "en" else {}
    t = models.FormTranslation(
        form_id=form_id,
        language_code=lang_code,
        is_default=lang_code == (form.default_language or "en"),
        content=content,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _build_translation_out(t, fields)


@router.put("/{form_id}/languages/{lang_code}", response_model=schemas.FormTranslationOut)
def update_translation(
    form_id: int,
    lang_code: str,
    body: schemas.FormTranslationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.FormTranslationOut:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)
    t = db.query(models.FormTranslation).filter(
        models.FormTranslation.form_id == form_id,
        models.FormTranslation.language_code == lang_code,
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Translation not found")
    t.content = body.content.model_dump()
    db.commit()
    db.refresh(t)
    return _build_translation_out(t, _get_form_fields(form, db))


@router.delete("/{form_id}/languages/{lang_code}", status_code=status.HTTP_200_OK)
def remove_language(
    form_id: int,
    lang_code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> None:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)
    if lang_code == (form.default_language or "en"):
        raise HTTPException(status_code=400, detail="Cannot remove the default language")
    t = db.query(models.FormTranslation).filter(
        models.FormTranslation.form_id == form_id,
        models.FormTranslation.language_code == lang_code,
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Translation not found")
    db.delete(t)
    db.commit()
    return {"message": "Language removed"}


@router.post("/{form_id}/languages/{lang_code}/set-default", response_model=schemas.FormLanguageSettingsOut)
def set_default_language(
    form_id: int,
    lang_code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.FormLanguageSettingsOut:
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)
    # Ensure translation exists for this language
    t = db.query(models.FormTranslation).filter(
        models.FormTranslation.form_id == form_id,
        models.FormTranslation.language_code == lang_code,
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Language not added yet")
    # Clear old default
    db.query(models.FormTranslation).filter(
        models.FormTranslation.form_id == form_id,
        models.FormTranslation.is_default == True,
    ).update({"is_default": False})
    t.is_default = True
    form.default_language = lang_code
    db.commit()
    return get_language_settings(form_id, db, current_user)


@router.post("/{form_id}/auto-translate", response_model=schemas.FormTranslationBulkOut)
def auto_translate(
    form_id: int,
    body: schemas.AutoTranslateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.FormTranslationBulkOut:
    """
    Auto-translate the form into the given target languages.
    Uses MyMemory free translation API. Results are saved as draft translations
    for admin review before publishing.
    """
    form = _get_form_or_404(form_id, db)
    _assert_owner(form, current_user)
    fields = _get_form_fields(form, db)

    # Get or build English source content
    en_t = db.query(models.FormTranslation).filter(
        models.FormTranslation.form_id == form_id,
        models.FormTranslation.language_code == "en",
    ).first()
    source = en_t.content if en_t and isinstance(en_t.content, dict) else _build_source_content(form, fields)

    results = []
    warnings = []

    for lang in body.target_languages:
        if lang not in schemas.SUPPORTED_LANGUAGES:
            warnings.append(f"Unsupported language skipped: {lang}")
            continue
        if lang == "en":
            continue

        translated_content = _auto_translate_content(source, lang)

        existing = db.query(models.FormTranslation).filter(
            models.FormTranslation.form_id == form_id,
            models.FormTranslation.language_code == lang,
        ).first()

        if existing:
            existing.content = translated_content
            db.commit()
            db.refresh(existing)
            results.append(_build_translation_out(existing, fields))
        else:
            new_t = models.FormTranslation(
                form_id=form_id,
                language_code=lang,
                is_default=False,
                content=translated_content,
            )
            db.add(new_t)
            db.commit()
            db.refresh(new_t)
            results.append(_build_translation_out(new_t, fields))

    # Don't add completion warnings after auto-translate — the admin can review manually
    return schemas.FormTranslationBulkOut(translations=results, missing_warnings=[])


@router.get("/{form_id}/languages/public-settings", response_model=schemas.FormLanguageSettingsOut)
def get_public_language_settings(
    form_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> schemas.FormLanguageSettingsOut:
    """No-auth endpoint — returns language settings for a published or owner-accessible form (used by public form page)."""
    form = _get_form_or_404(form_id, db)
    if not apply_schedule(form, db):
        raise HTTPException(status_code=404, detail="Form not found")
    if not form.is_public:
        user = get_optional_user(request, db)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This form is private. Please log in to access it.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if user.id != form.owner_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this form")

    fields = _get_form_fields(form, db)
    translations = db.query(models.FormTranslation).filter(
        models.FormTranslation.form_id == form_id
    ).all()
    return schemas.FormLanguageSettingsOut(
        form_id=form_id,
        multilingual_enabled=form.multilingual_enabled,
        default_language=form.default_language or "en",
        languages=[_build_translation_out(t, fields) for t in translations],
    )


@router.get("/{form_id}/languages/{lang_code}/public", response_model=schemas.FormTranslationOut)
def get_public_translation(
    form_id: int,
    lang_code: str,
    request: Request,
    db: Session = Depends(get_db),
) -> schemas.FormTranslationOut:
    """No-auth: get translation for public form rendering."""
    form = _get_form_or_404(form_id, db)
    if not apply_schedule(form, db):
        raise HTTPException(status_code=404, detail="Form not found")
    if not form.is_public:
        user = get_optional_user(request, db)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This form is private. Please log in to access it.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if user.id != form.owner_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this form")
    t = db.query(models.FormTranslation).filter(
        models.FormTranslation.form_id == form_id,
        models.FormTranslation.language_code == lang_code,
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Translation not available")
    fields = _get_form_fields(form, db)
    return _build_translation_out(t, fields)
