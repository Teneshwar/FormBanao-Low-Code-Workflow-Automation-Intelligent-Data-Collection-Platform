from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional
from urllib import error, request

import firebase_admin
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request, status
from firebase_admin import auth as fb_auth
from firebase_admin import credentials as fb_credentials
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..notifications import fire_and_forget, send_welcome_email
from ..services.admin_account_policy import AdminAccountPolicy

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_HOURS = 24
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY") or os.getenv("VITE_FIREBASE_API_KEY")

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta if expires_delta else timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_firebase_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token and return basic user info.
    Prefer using the Admin SDK (service account) when available; fall back
    to the Identity Toolkit REST lookup if the API key is configured.
    """
    # Prefer admin SDK verification when service account is present
    try:
        if firebase_admin._apps:
            # Will raise ValueError if token invalid
            decoded = fb_auth.verify_id_token(id_token)
            uid = decoded.get("uid")
            email = decoded.get("email")
            # fetch user record to get email_verified and phone number
            try:
                user_rec = fb_auth.get_user(uid)
                custom_claims = getattr(user_rec, "custom_claims", {}) or {}
                return {
                    "firebase_uid": uid,
                    "email": email,
                    "email_verified": getattr(user_rec, "email_verified", False),
                    "phone_number": getattr(user_rec, "phone_number", None),
                    "custom_claims": custom_claims,
                }
            except Exception:
                # If fetching user record fails, still return what we have
                return {
                    "firebase_uid": uid,
                    "email": email,
                    "email_verified": False,
                    "phone_number": None,
                    "custom_claims": {},
                }
    except Exception:
        # fallthrough to REST lookup below
        pass

    # Fallback: use REST lookup (requires API key)
    if not FIREBASE_API_KEY:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Firebase API key is not configured and Admin SDK unavailable")

    payload = json.dumps({"idToken": id_token}).encode("utf-8")
    req = request.Request(
        f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_API_KEY}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=10) as response:
            data = json.load(response)
    except error.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token") from exc

    users = data.get("users") or []
    if not users:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token")

    firebase_user = users[0]
    # Parse any customAttributes (Identity Toolkit may provide them as a JSON string)
    custom_attrs = {}
    custom_raw = firebase_user.get("customAttributes") or firebase_user.get("customAttributes")
    if custom_raw:
        try:
            custom_attrs = json.loads(custom_raw)
        except Exception:
            custom_attrs = {}

    return {
        "firebase_uid": firebase_user.get("localId"),
        "email": firebase_user.get("email"),
        "email_verified": firebase_user.get("emailVerified", False),
        "phone_number": firebase_user.get("phoneNumber"),
        "custom_claims": custom_attrs,
    }


def _ensure_firebase_admin() -> None:
    if firebase_admin._apps:
        return

    service_account_path = os.path.join(os.path.dirname(__file__), "..", "firebase-service-account.json")
    if not os.path.exists(service_account_path):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Firebase admin service account is not configured")

    credential = fb_credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(credential)


def _cleanup_stale_firebase_user_by_email(db: Session, email: str) -> bool:
    existing_user = db.query(models.User).filter(models.User.email == email).first()
    if existing_user is not None:
        return False

    try:
        firebase_user = fb_auth.get_user_by_email(email)
    except fb_auth.UserNotFoundError:
        return False

    fb_auth.delete_user(firebase_user.uid)
    return True


def _log_action(
    db: Session,
    action: str,
    user_id: Optional[int] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    log = models.AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(log)


# â”€â”€ Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.post("/pending-role")
def set_pending_role(payload: schemas.PendingRoleCreate, db: Session = Depends(get_db)) -> dict:
    """Store a short-lived pending role selection for the given email.

    This makes registration robust when users verify email from another device
    by persisting the chosen role server-side for a short TTL (default 24h).
    """
    email = payload.email.lower().strip()
    role = (payload.role or "user").strip().lower()
    expires = datetime.utcnow() + timedelta(hours=24)

    existing = (
        db.query(models.PendingRole)
        .filter(models.PendingRole.email == email)
        .filter(models.PendingRole.used_at.is_(None))
        .first()
    )
    if existing:
        existing.role = role
        existing.created_at = datetime.utcnow()
        existing.expires_at = expires
    else:
        pr = models.PendingRole(email=email, role=role, created_at=datetime.utcnow(), expires_at=expires)
        db.add(pr)
    db.commit()
    return {"ok": True}


@router.post("/register")
def register(*_, **__):
    """
    Registration via the API is deprecated when using Firebase Authentication.
    Create accounts through Firebase on the client and then sign in to exchange
    the Firebase ID token at /auth/firebase.
    """
    raise HTTPException(status_code=status.HTTP_410_GONE, detail="Use Firebase client SDK to create accounts and verify email. Register via /auth/firebase by exchanging a Firebase ID token after client-side sign-in.")


@router.post("/firebase", response_model=schemas.Token)
def firebase_auth(
    payload: schemas.FirebaseAuthRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    firebase_user = verify_firebase_token(payload.id_token)
    email = firebase_user.get("email")
    firebase_uid = firebase_user.get("firebase_uid")
    email_verified = firebase_user.get("email_verified")
    phone_number = firebase_user.get("phone_number")
    # Public registration and login through the frontend can select an account role,
    # but only Firebase custom claims or the same Firebase exchange on a brand-new
    # account can truthfully lift a persisted user to `is_superuser`.
    # Legacy password/login is still denied a client-side admin self-upgrade once
    # the local user already exists.

    if not firebase_uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token")

    # Allow login if either email is verified or the phone number is present (phone OTP verified)
    if not (email_verified or phone_number):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email or phone not verified")

    # Determine admin status from Firebase custom claims (if present).
    # Requested admin role is accepted only as a registration-time signal that can
    # create `is_superuser` for a brand-new persistent account; it is not a portable
    # admin grant for an already linked user.
    claims = firebase_user.get("custom_claims") or {}

    # Consult server-side pending role if the client did not include one.
    pending = None
    pending_role = None
    try:
        if email:
            pending = (
                db.query(models.PendingRole)
                .filter(models.PendingRole.email == email.lower())
                .filter(models.PendingRole.used_at.is_(None))
                .filter(models.PendingRole.expires_at > datetime.utcnow())
                .order_by(models.PendingRole.created_at.desc())
                .first()
            )
            if pending:
                pending_role = pending.role
    except Exception:
        pending = None

    user = db.query(models.User).filter(models.User.firebase_uid == firebase_uid).first()
    if not user:
        user = db.query(models.User).filter(models.User.email == email).first()

    role_arg = payload.role
    if pending_role and (not user or not user.firebase_uid):
        # If a registration flow chose admin and the user is being created or
        # first linked, honor the server-side pending role even if the login form
        # later defaulted to "user".
        role_arg = pending_role
    role = AdminAccountPolicy.resolve_requested_role(role_arg, claims)
    is_admin_claim = bool(
        claims.get("admin")
        or claims.get("is_admin")
        or claims.get("superuser")
        or (claims.get("role") == "admin")
    )

    if not user:
        hashed = get_password_hash(str(uuid.uuid4()))
        user = models.User(
            email=email,
            firebase_uid=firebase_uid,
            hashed_password=hashed,
            full_name=payload.full_name,
            is_superuser=False,
        )
        db.add(user)
        db.flush()
        user.is_superuser = AdminAccountPolicy.create_or_upgrade_superuser(
            user=user,
            role=role,
            is_new_account=True,
            firebase_claims=claims,
        )
        # If a server-side pending role record was used, mark it as consumed so it
        # cannot be reused and to make the process robust across devices.
        try:
            if pending and getattr(pending, 'used_at', None) is None:
                pending.used_at = datetime.utcnow()
                db.add(pending)
        except Exception:
            pass

        # Audit: record whether the account was created as admin (claims or requested)
        try:
            _log_action(db, "user.created_via_firebase", user_id=user.id, resource_type="user", resource_id=user.id,
                        details={"is_admin_claim": bool(is_admin_claim), "requested_role": role, "email_verified": bool(email_verified) },
                        ip_address=request.client.host if request.client else None)
        except Exception:
            pass
    else:
        # If a local user record exists but has never been linked to Firebase (firebase_uid is None),
        # treat the first-time Firebase link as a registration-like exchange for role decisions.
        # This allows a user who created a Firebase account and then completed email verification
        # to be provisioned as admin during the token exchange even if a stale unlinked local record exists.
        linking_first_time = not user.firebase_uid
        if linking_first_time:
            user.firebase_uid = firebase_uid
        if payload.full_name and not user.full_name:
            user.full_name = payload.full_name
        if user.email != email:
            user.email = email

        try:
            # If we're linking-to-Firebase for the first time, allow the role decision to behave
            # like a new-account exchange so the client-selected role (admin) can be respected.
            user.is_superuser = AdminAccountPolicy.create_or_upgrade_superuser(
                user=user,
                role=role,
                is_new_account=linking_first_time,
                firebase_claims=claims,
            )
        except PermissionError as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin account required") from exc

        # Mark pending role used when applied
        try:
            if pending and getattr(pending, 'used_at', None) is None:
                pending.used_at = datetime.utcnow()
                db.add(pending)
        except Exception:
            pass

        if user.is_superuser and not is_admin_claim:
            try:
                _log_action(db, "user.promoted_via_firebase_claim", user_id=user.id, resource_type="user", resource_id=user.id,
                            details={"is_admin_claim": False, "requested_role": role, "linked_first_time": bool(linking_first_time)}, ip_address=request.client.host if request.client else None)
            except Exception:
                pass

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")

    access_token = create_access_token({"sub": user.email})

    _log_action(
        db,
        action="user.firebase_login",
        user_id=user.id,
        resource_type="user",
        resource_id=user.id,
        details={"email": user.email, "firebase_uid": firebase_uid},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(user)
    return {"access_token": access_token, "token_type": "bearer"}



@router.post("/cleanup-stale-firebase-user")
def cleanup_stale_firebase_user(
    payload: schemas.CleanupFirebaseUserRequest,
    db: Session = Depends(get_db),
) -> dict:
    _ensure_firebase_admin()

    try:
        firebase_user = fb_auth.get_user_by_email(payload.email)
    except fb_auth.UserNotFoundError:
        return {"deleted": False, "message": "No Firebase account exists for this email."}

    local_user = db.query(models.User).filter(models.User.email == payload.email).first()
    if local_user is not None and local_user.firebase_uid == firebase_user.uid:
        return {"deleted": False, "message": "This Firebase user is already linked to an active local account."}

    fb_auth.delete_user(firebase_user.uid)
    if local_user is not None:
        local_user.firebase_uid = None
    db.commit()
    return {"deleted": True, "message": "Stale Firebase account removed and account can be recreated."}


@router.post('/password_reset/start', status_code=status.HTTP_410_GONE)
def password_reset_start(*_, **__):
    """
    Password reset via server-side OTP is deprecated when using Firebase Authentication.
    Use Firebase client SDK's sendPasswordResetEmail() to send reset links to users.
    """
    raise HTTPException(status_code=status.HTTP_410_GONE, detail="Use Firebase client SDK to send password reset emails (sendPasswordResetEmail). Server-side OTP password reset is disabled.")


@router.post('/password_reset/verify', status_code=status.HTTP_410_GONE)
def password_reset_verify(*_, **__):
    """
    Server-side password-reset verify is deprecated. Use Firebase client SDK's
    sendPasswordResetEmail() for password resets.
    """
    raise HTTPException(status_code=status.HTTP_410_GONE, detail="Server-side password-reset verify is disabled. Use Firebase client SDK to handle password resets.")





@router.post('/email_otp/verify', status_code=status.HTTP_410_GONE)
def verify_email_otp(*_, **__):
    """
    Deprecated: email OTP verification is removed when using Firebase Authentication.
    Create accounts on the client using Firebase SDK and verify email via Firebase.
    After the client signs in, exchange the Firebase ID token at /auth/firebase.
    """
    raise HTTPException(status_code=status.HTTP_410_GONE, detail="Email OTP verification is deprecated. Use Firebase client SDK to create and verify accounts.")



@router.post('/otp_attempt', status_code=status.HTTP_410_GONE)
def log_otp_attempt(*_, **__):
    """
    Deprecated: OTP attempt logging endpoint removed as OTPs are no longer used.
    """
    raise HTTPException(status_code=status.HTTP_410_GONE, detail="OTP endpoints are deprecated. Use Firebase Authentication for verification and analytics.")



@router.post("/login", response_model=schemas.Token)
async def login(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    form_data = await request.form()
    username = form_data.get("username")
    password = form_data.get("password")
    requested_role = (form_data.get("role") or "user").lower()

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required",
        )

    user = (
        db.query(models.User)
        .filter(models.User.email == username)
        .first()
    )
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if requested_role == "admin" and not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account required",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )

    access_token = create_access_token({"sub": user.email})

    _log_action(
        db,
        action="user.login",
        user_id=user.id,
        resource_type="user",
        resource_id=user.id,
        details={"email": user.email},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserOut)
def get_me(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    return current_user


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> dict:
    from ..dependencies import oauth2_scheme
    from fastapi.security.utils import get_authorization_scheme_param
    from jose import jwt as _jwt

    auth_header = request.headers.get("Authorization", "")
    _, token_value = get_authorization_scheme_param(auth_header)

    try:
        payload = _jwt.decode(token_value, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            db.add(models.TokenBlocklist(
                jti=jti,
                user_id=current_user.id,
                expires_at=datetime.utcfromtimestamp(exp),
            ))
    except Exception:
        pass  # token already invalid, still count as logged out

    _log_action(db, "user.logout", user_id=current_user.id,
                resource_type="user", resource_id=current_user.id,
                ip_address=request.client.host if request.client else None)
    db.commit()
    return {"message": "Successfully logged out"}





