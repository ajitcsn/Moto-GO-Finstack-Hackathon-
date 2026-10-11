import asyncio
import json

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import any_mock
from ..db import SessionLocal, get_db
from ..errors import ApiError
from ..finance_config import LENDER, all_steps, get_step_spec
from ..models import Application, Consent, Document, Event, Offer, User
from ..security import current_user
from ..services import core, finance

router = APIRouter(prefix="/applications", tags=["finance"])


class CreateIn(BaseModel):
    goal_id: str | None = None
    values: dict


class StepIn(BaseModel):
    values: dict = {}
    submit: bool = False


class AcceptIn(BaseModel):
    kfs_version: str
    acknowledged: bool


class ConsentIn(BaseModel):
    type: str


@router.get("")
def list_apps(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(Application).filter_by(user_id=user.id).order_by(Application.created_at.desc()).all()
    return {"items": [finance.serialize(db, a) for a in rows]}


@router.post("", status_code=201)
def create(body: CreateIn, user: User = Depends(current_user), db: Session = Depends(get_db),
           idempotency_key: str | None = Header(None)):
    def go():
        app = finance.create_application(db, user, body.values, body.goal_id)
        db.commit()
        return 201, finance.serialize(db, app)

    status, resp = core.idempotent(db, user.id, idempotency_key, "POST /applications", go)
    from fastapi.responses import JSONResponse

    return JSONResponse(resp, status_code=status)


@router.get("/intake/schema")
def intake_schema(user: User = Depends(current_user)):
    spec = get_step_spec("intake")
    spec["demo"] = any_mock()
    spec["values"] = {}
    return spec


@router.get("/{app_id}")
def get_application(app_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    app = finance.get_app(db, user.id, app_id)
    out = finance.serialize(db, app)
    out["documents"] = [finance.ser_doc(d) for d in db.query(Document).filter_by(application_id=app.id).order_by(Document.created_at)]
    out["steps_order"] = ["intake", "identity", "kyc", "bureau", "evidence", "work", "vehicle"]
    return out


@router.get("/{app_id}/steps/{step}/schema")
def step_schema(app_id: str, step: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return finance.get_step(db, user, finance.get_app(db, user.id, app_id), step)


@router.put("/{app_id}/steps/{step}")
def put_step(app_id: str, step: str, body: StepIn, user: User = Depends(current_user), db: Session = Depends(get_db),
             idempotency_key: str | None = Header(None)):
    app = finance.get_app(db, user.id, app_id)

    def go():
        out = finance.save_step(db, user, app, step, body.values, body.submit)
        db.commit()
        out["application"] = finance.serialize(db, app)
        return 200, out

    status, resp = core.idempotent(db, user.id, idempotency_key, f"PUT {app_id}/{step}", go) if body.submit else go()
    from fastapi.responses import JSONResponse

    return JSONResponse(resp, status_code=status)


@router.post("/{app_id}/consents")
def post_consent(app_id: str, body: ConsentIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    app = finance.get_app(db, user.id, app_id)
    for st in all_steps():
        for f in get_step_spec(st)["fields"]:
            c = f.get("consent")
            if c and c["type"] == body.type:
                rec = core.record_consent(db, user.id, c["type"], c["purpose"], c["recipient"], c["version"], app.id)
                db.commit()
                return {"id": rec.id, "type": rec.type}
    raise ApiError("validation_error", "Unknown consent type.", 422, field="type")


@router.post("/{app_id}/cancel")
def cancel(app_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    app = finance.get_app(db, user.id, app_id)
    finance.cancel(db, app)
    db.commit()
    return finance.serialize(db, app)


@router.get("/{app_id}/timeline")
def timeline(app_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    app = finance.get_app(db, user.id, app_id)
    rows = db.query(Event).filter_by(application_id=app.id).order_by(Event.id).all()
    return {"items": [{"id": e.id, "type": e.type, "summary": e.summary, "state": e.state, "provider": e.provider,
                       "at": e.received_at.isoformat()} for e in rows if not e.type.startswith("provider.")]}


@router.get("/{app_id}/documents")
def app_documents(app_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    app = finance.get_app(db, user.id, app_id)
    return {"items": [finance.ser_doc(d) for d in db.query(Document).filter_by(application_id=app.id)]}


@router.get("/{app_id}/offers")
def offers(app_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    app = finance.get_app(db, user.id, app_id)
    rows = db.query(Offer).filter_by(application_id=app.id).order_by(Offer.tenure).all()
    if rows:
        core.track("offer_viewed", app=app.id)
    return {"items": [finance.ser_offer(o) for o in rows], "accepted_offer_id": app.accepted_offer_id}


def _offer(db, app, offer_id) -> Offer:
    o = db.get(Offer, offer_id)
    if not o or o.application_id != app.id:
        raise ApiError("not_found", "Offer not found.", 404)
    return o


@router.get("/{app_id}/offers/{offer_id}/kfs")
def kfs(app_id: str, offer_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    app = finance.get_app(db, user.id, app_id)
    return finance.kfs_for(db, app, _offer(db, app, offer_id))


@router.post("/{app_id}/offers/{offer_id}/accept")
def accept(app_id: str, offer_id: str, body: AcceptIn, user: User = Depends(current_user), db: Session = Depends(get_db),
           idempotency_key: str | None = Header(None)):
    app = finance.get_app(db, user.id, app_id)

    def go():
        finance.accept_offer(db, user, app, offer_id, body.kfs_version, body.acknowledged)
        db.commit()
        return 200, finance.serialize(db, app)

    status, resp = core.idempotent(db, user.id, idempotency_key, f"POST {app_id}/accept", go)
    from fastapi.responses import JSONResponse

    return JSONResponse(resp, status_code=status)


@router.get("/{app_id}/events")
async def sse(app_id: str, request: Request, last_event_id: int = 0, user: User = Depends(current_user),
              db: Session = Depends(get_db)):
    finance.get_app(db, user.id, app_id)
    db.close()
    last = int(request.headers.get("last-event-id", last_event_id) or 0)

    async def stream():
        nonlocal last
        beat = 0
        yield "retry: 3000\n\n"
        while not await request.is_disconnected():
            s = SessionLocal()
            try:
                rows = s.query(Event).filter(Event.application_id == app_id, Event.id > last).order_by(Event.id).all()
                data = [(e.id, e.type, e.state, e.summary) for e in rows]
            finally:
                s.close()
            for eid, typ, state, summary in data:
                last = eid
                yield f"id: {eid}\nevent: status\ndata: {json.dumps({'type': typ, 'state': state, 'summary': summary})}\n\n"
            beat += 1
            if not data and beat % 15 == 0:
                yield ": keep-alive\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
