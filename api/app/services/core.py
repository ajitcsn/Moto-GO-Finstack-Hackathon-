"""Cross-cutting helpers: analytics, consents, idempotency, event log, job runner."""
from __future__ import annotations

import hashlib
import json
import logging
import random
import threading
import time
from typing import Any, Callable

from sqlalchemy import event
from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal, utcnow
from ..errors import ApiError
from ..models import Consent, Event, IdempotencyKey

alog = logging.getLogger("motogo.analytics")

ANALYTICS_EVENTS = {
    "garage_created", "vehicle_added", "model_saved", "goal_created", "finance_started", "step_submitted",
    "consent_completed", "document_uploaded", "document_result", "requirement_created", "offer_viewed",
    "offer_selected", "signed", "disbursal_confirmed",
}


def track(name: str, **ids: str | int) -> None:
    """IDs and step names only. Never document contents, bureau data or amounts."""
    alog.info("event=%s %s", name, " ".join(f"{k}={v}" for k, v in ids.items()))


def sha(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()


def add_event(db: Session, app_id: str, type_: str, summary: str, *, state: str | None = None,
              provider: str | None = None, idempotency_key: str | None = None, payload: Any = None) -> Event:
    e = Event(application_id=app_id, type=type_, summary=summary, state=state, provider=provider,
              idempotency_key=idempotency_key, payload_hash=sha(payload) if payload is not None else None)
    db.add(e)
    db.flush()
    return e


# ---------- consents ----------
def record_consent(db: Session, user_id: str, type_: str, purpose: str, recipient: str, version: str,
                   application_id: str | None = None) -> Consent:
    c = Consent(user_id=user_id, application_id=application_id, type=type_, purpose=purpose,
                recipient=recipient, text_version=version)
    db.add(c)
    db.flush()
    track("consent_completed", type=type_, user=user_id)
    return c


def consent_active(db: Session, app_id: str, type_: str) -> bool:
    last = (db.query(Consent).filter(Consent.application_id == app_id, Consent.type == type_)
            .order_by(Consent.granted_at.desc()).first())
    return bool(last and last.withdrawn_at is None)


def require_consent(db: Session, app_id: str, type_: str) -> None:
    """A withdrawn consent blocks further provider calls for that purpose."""
    last = (db.query(Consent).filter(Consent.application_id == app_id, Consent.type == type_)
            .order_by(Consent.granted_at.desc()).first())
    if last is not None and last.withdrawn_at is not None:
        raise ApiError("consent_withdrawn", f"You withdrew your {type_} consent, so we can't continue this step.", 409)


# ---------- idempotency ----------
def idempotent(db: Session, user_id: str, key: str | None, route: str, fn: Callable[[], tuple[int, dict]]):
    """Replay the stored response when the same Idempotency-Key is re-sent."""
    if not key:
        return fn()
    row = db.get(IdempotencyKey, (key, user_id))
    if row:
        if row.route != route:
            raise ApiError("idempotency_conflict", "This Idempotency-Key was used for a different request.", 422)
        return row.status_code, row.response
    status, resp = fn()
    db.add(IdempotencyKey(key=key, user_id=user_id, route=route, status_code=status, response=resp))
    db.commit()
    return status, resp


# ---------- background jobs ----------
def mock_delay() -> float:
    return random.uniform(settings.mock_delay_min, settings.mock_delay_max)


def run_job(db: Session, fn: Callable[..., None], *args, delay: float = 0.0) -> None:
    """In-process worker, queued until the caller's transaction commits (so the job sees committed state).
    Swap for Celery/RQ (same signature) in the pilot."""
    def _go():
        if delay and not settings.sync_jobs:
            time.sleep(delay)
        jdb = SessionLocal()
        try:
            fn(jdb, *args)
            jdb.commit()
        except Exception:  # noqa: BLE001
            jdb.rollback()
            logging.getLogger("motogo.jobs").exception("job %s failed", getattr(fn, "__name__", fn))
        finally:
            jdb.close()

    def _start():
        if settings.sync_jobs:
            _go()
        else:
            threading.Thread(target=_go, daemon=True).start()

    db.info.setdefault("jobs", []).append(_start)


@event.listens_for(Session, "after_commit")
def _fire_jobs(session):
    for start in session.info.pop("jobs", []):
        start()


@event.listens_for(Session, "after_rollback")
def _drop_jobs(session):
    session.info.pop("jobs", None)


__all__ = ["track", "add_event", "record_consent", "consent_active", "require_consent", "idempotent",
           "run_job", "mock_delay", "sha", "utcnow"]
