"""Webhooks, mock provider screens, ops console and analytics."""
import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import adapters, crypto
from ..config import any_mock, settings
from ..db import get_db
from ..errors import ApiError
from ..finance_config import get_step_spec
from ..models import Application, ApplicationStep, Consent, Document, Event, Requirement, User
from ..security import current_user, ops_user
from ..services import core, finance

router = APIRouter(tags=["misc"])
audit = logging.getLogger("motogo.audit")

WEBHOOK_EVENTS = {"mandate.active": "mandate", "esign.completed": "esign", "aa.completed": "aa", "disbursal.confirmed": "lender.disbursal"}


@router.post("/webhooks/{provider}")
async def webhook(provider: str, request: Request, x_signature: str = Header(""), db: Session = Depends(get_db)):
    raw = await request.body()
    expected = hmac.new(settings.webhook_secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_signature):  # verified before any processing
        raise ApiError("bad_signature", "Signature check failed.", 401)
    try:
        payload = json.loads(raw)
        event_id, typ, app_id = payload["event_id"], payload["type"], payload["application_id"]
    except (ValueError, KeyError):
        raise ApiError("validation_error", "Malformed webhook.", 422)
    app = db.get(Application, app_id)
    if not app:
        raise ApiError("not_found", "Unknown application.", 404)
    if db.query(Event).filter_by(application_id=app_id, idempotency_key=event_id, provider=provider).first():
        return {"status": "duplicate"}  # replay protection
    core.add_event(db, app_id, f"webhook.{typ}", f"{provider}: {typ}", provider=provider, idempotency_key=event_id,
                   payload=payload)
    if typ not in WEBHOOK_EVENTS:
        db.commit()
        return {"status": "ignored"}
    finance.complete_provider(db, app, WEBHOOK_EVENTS[typ], payload.get("ref"))
    db.commit()
    return {"status": "processed"}


class MockComplete(BaseModel):
    application_id: str
    ref: str | None = None


@router.post("/mock/provider/{provider}/complete")
def mock_complete(provider: str, body: MockComplete, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Stands in for the provider redirect-return. Only available while that adapter is a mock."""
    if provider not in ("aa", "esign") or not adapters.is_mock(provider):
        raise ApiError("not_found", "Not available.", 404)
    app = finance.get_app(db, user.id, body.application_id)
    finance.complete_provider(db, app, provider, body.ref)
    db.commit()
    return finance.serialize(db, app)


@router.get("/meta")
def meta():
    return {"demo": any_mock(), "otp_hint": "123456" if adapters.is_mock("otp") else None,
            "adapters": {n: getattr(settings, f"adapter_{n}") for n in
                         ("otp", "kyc", "bureau", "aa", "lender", "mandate", "esign", "valuation", "docparser")}}


class AnalyticsIn(BaseModel):
    name: str
    ids: dict[str, str] = {}


@router.post("/analytics", status_code=202)
def analytics(body: AnalyticsIn, user: User = Depends(current_user)):
    if body.name in core.ANALYTICS_EVENTS:
        core.track(body.name, **{k: str(v)[:40] for k, v in list(body.ids.items())[:4] if k in ("step", "app", "model", "vehicle", "goal")})
    return {"ok": True}


# ---------------- ops console (read-only, role-gated, audit-logged) ----------------
@router.get("/ops/applications")
def ops_list(ops: User = Depends(ops_user), db: Session = Depends(get_db)):
    audit.info("ops=%s action=list_applications", ops.id)
    rows = db.query(Application).order_by(Application.updated_at.desc()).limit(100).all()
    return {"items": [{"id": a.id, "state": a.state, "current_step": a.current_step, "user_id": a.user_id,
                       "updated_at": a.updated_at.isoformat()} for a in rows]}


@router.get("/ops/applications/{app_id}")
def ops_detail(app_id: str, ops: User = Depends(ops_user), db: Session = Depends(get_db)):
    audit.info("ops=%s action=view_application app=%s", ops.id, app_id)
    app = db.get(Application, app_id)
    if not app:
        raise ApiError("not_found", "Application not found.", 404)
    steps = []
    for s in db.query(ApplicationStep).filter_by(application_id=app.id):
        spec = get_step_spec(s.step_id)
        masked = finance.mask_payload(spec, s.payload_json) if spec else {}
        steps.append({"step": s.step_id, "status": s.status, "values": masked if spec else {}})
    return {
        "application": finance.serialize(db, app),
        "steps": steps,
        "timeline": [{"at": e.received_at.isoformat(), "type": e.type, "summary": e.summary, "state": e.state,
                      "provider": e.provider, "payload_hash": e.payload_hash} for e in
                     db.query(Event).filter_by(application_id=app.id).order_by(Event.id)],
        "documents": [finance.ser_doc(d) for d in db.query(Document).filter_by(application_id=app.id)],
        "consents": [{"type": c.type, "recipient": c.recipient, "text_version": c.text_version,
                      "granted_at": c.granted_at.isoformat(), "withdrawn_at": c.withdrawn_at.isoformat() if c.withdrawn_at else None}
                     for c in db.query(Consent).filter_by(application_id=app.id).order_by(Consent.granted_at)],
    }
