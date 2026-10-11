import hmac
import secrets
from datetime import timedelta

import jwt
from fastapi import Depends, Request, Response
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db, utcnow
from .errors import ApiError
from .models import User

ACCESS, REFRESH, CSRF = "mf_access", "mf_refresh", "mf_csrf"
CSRF_EXEMPT = ("/api/v1/auth/otp/", "/api/v1/webhooks/", "/api/v1/storage/", "/api/v1/auth/refresh", "/api/v1/mock/")


def _encode(sub: str, kind: str, ttl: timedelta) -> str:
    now = utcnow()
    return jwt.encode({"sub": sub, "typ": kind, "iat": now, "exp": now + ttl}, settings.secret_key, algorithm="HS256")


def _decode(token: str, kind: str) -> str:
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise ApiError("unauthenticated", "Please sign in again.", 401)
    if data.get("typ") != kind:
        raise ApiError("unauthenticated", "Please sign in again.", 401)
    return data["sub"]


def start_session(response: Response, user: User) -> None:
    kw = dict(httponly=True, samesite="lax", secure=settings.cookie_secure)
    response.set_cookie(ACCESS, _encode(user.id, "access", timedelta(minutes=settings.access_ttl_min)),
                        max_age=settings.access_ttl_min * 60, path="/", **kw)
    response.set_cookie(REFRESH, _encode(user.id, "refresh", timedelta(days=settings.refresh_ttl_days)),
                        max_age=settings.refresh_ttl_days * 86400, path="/api/v1/auth", **kw)
    response.set_cookie(CSRF, secrets.token_urlsafe(24), max_age=settings.refresh_ttl_days * 86400, path="/",
                        samesite="lax", secure=settings.cookie_secure)  # readable by JS on purpose


def end_session(response: Response) -> None:
    response.delete_cookie(ACCESS, path="/")
    response.delete_cookie(REFRESH, path="/api/v1/auth")
    response.delete_cookie(CSRF, path="/")


def user_from_refresh(request: Request, db: Session) -> User:
    tok = request.cookies.get(REFRESH)
    if not tok:
        raise ApiError("unauthenticated", "Please sign in again.", 401)
    u = db.get(User, _decode(tok, "refresh"))
    if not u:
        raise ApiError("unauthenticated", "Please sign in again.", 401)
    return u


def optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    tok = request.cookies.get(ACCESS)
    if not tok:
        return None
    try:
        return db.get(User, _decode(tok, "access"))
    except ApiError:
        return None


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    tok = request.cookies.get(ACCESS)
    if not tok:
        raise ApiError("unauthenticated", "Please sign in to continue.", 401)
    u = db.get(User, _decode(tok, "access"))
    if not u:
        raise ApiError("unauthenticated", "Please sign in to continue.", 401)
    return u


def ops_user(user: User = Depends(current_user)) -> User:
    if user.role != "ops":
        raise ApiError("forbidden", "Ops access only.", 403)
    return user


async def csrf_middleware(request: Request, call_next):
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.url.path.startswith("/api/v1"):
        if not request.url.path.startswith(CSRF_EXEMPT) and request.cookies.get(ACCESS):
            cookie, header = request.cookies.get(CSRF, ""), request.headers.get("x-csrf-token", "")
            if not cookie or not hmac.compare_digest(cookie, header):
                from fastapi.responses import JSONResponse

                return JSONResponse({"code": "csrf", "message": "Security check failed. Refresh and try again.",
                                     "field": None, "retryable": True}, status_code=403)
    return await call_next(request)
