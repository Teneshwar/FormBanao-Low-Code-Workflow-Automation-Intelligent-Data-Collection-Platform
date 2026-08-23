from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.security.utils import get_authorization_scheme_param
from jose import JWTError, jwt
from sqlalchemy.orm import Session
import os

from . import models, schemas
from .database import get_db

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        jti: str = payload.get("jti")
        if email is None:
            raise credentials_exception
        # Check token blocklist (logout support)
        if jti:
            blocked = db.query(models.TokenBlocklist).filter(
                models.TokenBlocklist.jti == jti
            ).first()
            if blocked:
                raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception

    user = (
        db.query(models.User)
        .filter(models.User.email == token_data.email)
        .first()
    )
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


def get_current_superuser(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> models.User | None:
    auth_header = request.headers.get("Authorization", "")
    scheme, token_value = get_authorization_scheme_param(auth_header)
    if scheme.lower() != "bearer" or not token_value:
        return None
    try:
        payload = jwt.decode(token_value, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            return None
        return (
            db.query(models.User)
            .filter(models.User.email == email)
            .first()
        )
    except JWTError:
        return None
