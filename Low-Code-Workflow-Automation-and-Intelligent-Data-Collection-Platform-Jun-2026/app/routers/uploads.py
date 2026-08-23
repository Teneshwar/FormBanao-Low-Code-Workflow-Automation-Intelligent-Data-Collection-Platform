from __future__ import annotations

import os
import uuid as _uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter()

# Files are stored in an 'uploads/' folder at the project root
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Max file size: 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain", "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _log(db: Session, action: str, user_id: int, resource_id: Optional[int] = None, ip: Optional[str] = None) -> None:
    db.add(models.AuditLog(
        user_id=user_id,
        action=action,
        resource_type="upload",
        resource_id=resource_id,
        ip_address=ip,
    ))


# ── POST /uploads — User: upload a file ──────────────────────────────────────

@router.post(
    "/uploads",
    response_model=schemas.UploadedFileOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Uploads"],
)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    submission_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.UploadedFile:
    """
    Upload a file (image, PDF, document, CSV, etc.).
    Optionally link the upload to a submission via submission_id query param.
    Max file size: 10 MB.
    """
    # Validate content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{file.content_type}' is not allowed.",
        )

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds maximum size of 10 MB.",
        )

    # Generate a unique stored filename to avoid collisions
    ext = os.path.splitext(file.filename or "file")[1]
    stored_filename = f"{_uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, stored_filename)

    # Write to disk
    with open(file_path, "wb") as f:
        f.write(contents)

    # Save metadata to DB
    upload = models.UploadedFile(
        original_filename=file.filename or stored_filename,
        stored_filename=stored_filename,
        file_path=file_path,
        file_size=len(contents),
        content_type=file.content_type,
        uploaded_by_id=current_user.id,
        submission_id=submission_id,
    )
    db.add(upload)
    db.flush()

    _log(db, "file.uploaded", current_user.id, resource_id=upload.id,
         ip=request.client.host if request.client else None)
    db.commit()
    db.refresh(upload)
    return upload


# ── GET /uploads/{id} — User or Admin: get file metadata ─────────────────────

@router.get(
    "/uploads/{upload_id}",
    response_model=schemas.UploadedFileOut,
    tags=["Uploads"],
)
def get_upload(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.UploadedFile:
    """
    Get upload metadata by ID.
    Accessible by: the user who uploaded the file OR any admin.
    """
    upload = db.query(models.UploadedFile).filter(
        models.UploadedFile.id == upload_id
    ).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    if upload.uploaded_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return upload
