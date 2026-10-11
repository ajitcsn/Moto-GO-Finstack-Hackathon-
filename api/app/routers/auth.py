import hashlib
import re
import time
from collections import defaultdict, deque
from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import adapters
from ..config import settings
from ..db import get_db, utcnow
from ..errors import ApiError
from ..models import OtpChallenge, Profile, User
from ..security import current_user, end_session, start_session, user_from_refresh
from ..services import core
from ..services.garage import level_for, xp_total

router = APIRouter(prefix="/auth", tags=["auth"])
TERMS_VERSION = "terms-2026-10-01"
PHONE_RE = re.compile(r"^[6-9][0-9]{9}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_hits: dict[str, deque] = defaultdict(deque)  # in-memory; use Redis for multi-instance deployments


def _limit(key: str, n: int, per: int = 3600) -> None:
    q, now = _hits[key], time.time()
    while q and q[0] < now - per:
        q.popleft()
    if len(q) >= n:
        raise ApiError("rate_limited", "Too many attempts. Please try again later.", 429, retryable=True)
    q.append(now)


def normalise(identifier: str) -> tuple[str, str]:
    s = identifier.strip()
    if "@" in s:
        if not EMAIL_RE.match(s):
            raise ApiError("validation_error", "Enter a valid email address.", 422, field="identifier")
        return "email", s.lower()
    digits = re.sub(r"[\s\-]", "", s)
    digits = digits[3:] if digits.startswith("+91") else digits
    if not PHONE_RE.match(digits):
        raise ApiError("validation_error", "Enter a 10-digit Indian mobile number starting with 6-9.", 422, field="identifier")
    return "phone", digits


def _h(identifier: str, code: str) -> str:
    return hashlib.sha256(f"{identifier}:{code}:{settings.secret_key}".encode()).hexdigest()


def ser_user(db: Session, u: User) -> dict:
    p = db.get(Profile, u.id)
    return {"id": u.id, "display_name": u.display_name, "phone": u.phone, "email": u.email, "role": u.role,
            "profile": {"city": p.city, "interests": p.interests, "ownership_tags": p.ownership_tags,
                        "story_done": p.story_done} if p else None, **level_for(xp_total(db, u.id))}


class OtpRequest(BaseModel):
    identifier: str


class OtpVerify(BaseModel):
    identifier: str
    code: str
    display_name: str | None = None
    adult: bool = False
    accept_terms: bool = False
    marketing_opt_in: bool = False


@router.post("/otp/request")
def otp_request(body: OtpRequest, request: Request, db: Session = Depends(get_db)):
    _, ident = normalise(body.identifier)
    _limit(f"otp:id:{ident}", 5)
    _limit(f"otp:ip:{request.client.host if request.client else '?'}", 30)
    now = utcnow()
    ch = db.get(OtpChallenge, ident)
    if ch and ch.locked_until and ch.locked_until > now:
        raise ApiError("otp_locked", "Too many wrong codes. Try again in a few minutes.", 423, retryable=True)
    if ch and (now - ch.last_sent_at).total_seconds() < 30:
        raise ApiError("resend_too_soon", "Please wait 30 seconds before asking for another code.", 429, retryable=True)
    otp = adapters.get("otp")
    code = otp.generate(ident)
    if ch:
        ch.code_hash, ch.expires_at, ch.attempts, ch.last_sent_at = _h(ident, code), now + timedelta(minutes=5), 0, now
    else:
        db.add(OtpChallenge(identifier=ident, code_hash=_h(ident, code), expires_at=now + timedelta(minutes=5), last_sent_at=now))
    db.commit()
    otp.deliver(ident, code)
    return {"sent": True, "expires_in": 300, "resend_after": 30,
            "demo_hint": "Demo mode: the code is 123456." if adapters.is_mock("otp") else None}


@router.post("/otp/verify")
def otp_verify(body: OtpVerify, response: Response, db: Session = Depends(get_db)):
    kind, ident = normalise(body.identifier)
    now = utcnow()
    ch = db.get(OtpChallenge, ident)
    if not ch or ch.expires_at < now:
        raise ApiError("otp_expired", "That code has expired. Ask for a new one.", 400, field="code", retryable=True)
    if ch.locked_until and ch.locked_until > now:
        raise ApiError("otp_locked", "Too many wrong codes. Try again in 10 minutes.", 423, retryable=True)
    if ch.code_hash != _h(ident, body.code.strip()):
        ch.attempts += 1
        if ch.attempts >= 3:
            ch.locked_until = now + timedelta(minutes=10)
            db.commit()
            raise ApiError("otp_locked", "Too many wrong codes. Try again in 10 minutes.", 423, field="code")
        db.commit()
        raise ApiError("otp_invalid", f"That code isn't right. {3 - ch.attempts} tries left.", 400, field="code")

    user = db.query(User).filter(User.phone == ident if kind == "phone" else User.email == ident).first()
    is_new = user is None
    if is_new:
        name = (body.display_name or "").strip()
        if not 2 <= len(name) <= 40:
            raise ApiError("validation_error", "Choose a display name (2-40 characters).", 422, field="display_name")
        if not body.adult:
            raise ApiError("validation_error", "You must be 18 or older to create an account.", 422, field="adult")
        if not body.accept_terms:
            raise ApiError("validation_error", "Please accept the terms and privacy notice.", 422, field="accept_terms")
        user = User(display_name=name, is_adult=True, phone=ident if kind == "phone" else None,
                    email=ident if kind == "email" else None)
        db.add(user)
        db.flush()
        db.add(Profile(user_id=user.id))
        core.record_consent(db, user.id, "terms", "Use Moto Go under the terms and privacy notice", "Moto Go", TERMS_VERSION)
        core.record_consent(db, user.id, "adult", "Declare that I am 18 or older", "Moto Go", TERMS_VERSION)
        if body.marketing_opt_in:
            core.record_consent(db, user.id, "marketing", "Receive product updates", "Moto Go", "marketing-v1")
    db.delete(ch)
    db.commit()
    start_session(response, user)
    return {"user": ser_user(db, user), "is_new": is_new}


@router.post("/refresh")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    u = user_from_refresh(request, db)
    start_session(response, u)
    return {"user": ser_user(db, u)}


@router.post("/logout")
def logout(response: Response):
    end_session(response)
    return {"ok": True}
