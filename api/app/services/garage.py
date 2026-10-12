"""Garage, valuation, equity, collection (XP) helpers."""
from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from .. import adapters
from ..errors import ApiError
from ..models import Activity, CareLog, CatalogueModel, Goal, LoanSnapshot, Valuation, Vehicle
from ..scenarios import equity_range

SEGMENTS = [("commute", "Commute"), ("touring", "Touring"), ("adventure", "Adventure"),
            ("performance", "Performance"), ("ev", "Electric")]

# (kind, category) -> xp. Saving and past-ownership earn none; repeats earn none (deduplicated by constraint).
XP_RULES = {"spotted": 10, "test_driven": 25, "saved": 0}
ACTIVITIES = {
    "spotted": ("spotted", ""), "ridden": ("experienced", "ridden"), "driven": ("experienced", "driven"),
    "rented": ("experienced", "rented"), "test_driven": ("test_driven", ""), "past_owned": ("experienced", "past_owned"),
    "saved": ("saved", ""),
}


def model_label(m: CatalogueModel | None, v: Vehicle | None = None) -> str:
    if m:
        return f"{m.make} {m.model}"
    return (v.free_text_model if v else None) or "Unknown vehicle"


def ser_model(m: CatalogueModel) -> dict:
    return {"id": m.id, "type": m.type, "make": m.make, "model": m.model, "variant": m.variant, "label": f"{m.make} {m.model}",
            "segment": m.segment, "price_low": m.price_low, "price_high": m.price_high, "specs": m.specs,
            "source": m.source, "as_of": m.as_of.isoformat()}


def latest_loan(db: Session, vehicle_id: str) -> LoanSnapshot | None:
    return db.query(LoanSnapshot).filter_by(vehicle_id=vehicle_id).order_by(LoanSnapshot.created_at.desc()).first()


def latest_valuation(db: Session, vehicle_id: str) -> Valuation | None:
    return db.query(Valuation).filter_by(vehicle_id=vehicle_id).order_by(Valuation.created_at.desc()).first()


def run_valuation(db: Session, v: Vehicle) -> Valuation:
    m = db.get(CatalogueModel, v.model_id) if v.model_id else None
    if not m:
        raise ApiError("valuation_unavailable", "We can only value models from the catalogue. Pick your model from the list.", 422)
    est = adapters.get("valuation").estimate(
        price_low=m.price_low, price_high=m.price_high, year=v.year, odometer=v.odometer, condition=v.condition,
        owners=v.owners, accident=v.accident_flag, modified=v.modified_flag, city=v.city)
    val = Valuation(vehicle_id=v.id, low=est["low"], mid=est["mid"], high=est["high"], confidence=est["confidence"],
                    source=est["source"], as_of=est["as_of"])
    db.add(val)
    db.flush()
    return val


def value_points(maximum_value: int | None) -> int:
    """One collection point for each ₹1,000 of the best current value estimate."""
    return max(1, maximum_value // 1_000) if maximum_value is not None else 0


def ser_loan(l: LoanSnapshot | None) -> dict:
    if not l:
        return {"status": "unknown", "lender": None, "principal": None, "statement_date": None, "source": "not_provided"}
    return {"status": l.status, "lender": l.lender, "principal": l.principal,
            "statement_date": l.statement_date.isoformat() if l.statement_date else None, "source": l.source,
            "document_id": l.document_id}


def ser_vehicle(db: Session, v: Vehicle) -> dict:
    m = db.get(CatalogueModel, v.model_id) if v.model_id else None
    val, loan = latest_valuation(db, v.id), latest_loan(db, v.id)
    loan_d = ser_loan(loan)
    eq = equity_range(val.low if val else None, val.high if val else None, loan_d["status"], loan_d["principal"])
    eq["confidence"] = None
    if eq["known"] and val:
        # confidence is capped by the weakest input: self-entered loan data is medium at best
        eq["confidence"] = "medium" if (loan_d["source"] == "user_entered" and val.confidence == "high") else val.confidence
    nxt = (db.query(CareLog).filter(CareLog.vehicle_id == v.id, CareLog.next_due.isnot(None))
           .order_by(CareLog.next_due).first())
    return {
        "id": v.id, "type": v.type, "model": ser_model(m) if m else None, "label": model_label(m, v),
        "verified_model": bool(m), "free_text_model": v.free_text_model, "variant": v.variant, "year": v.year,
        "ownership": v.ownership, "city": v.city, "odometer": v.odometer, "condition": v.condition, "owners": v.owners,
        "accident_flag": v.accident_flag, "modified_flag": v.modified_flag, "rc_document_id": v.rc_document_id,
        "delivery_status": v.delivery_status, "source": v.source,
        "valuation": ({"low": val.low, "mid": val.mid, "high": val.high, "confidence": val.confidence, "source": val.source,
                       "as_of": val.as_of.isoformat()} if val else None),
        "loan": loan_d, "equity": eq,
        "next_care": ({"kind": nxt.kind, "due": nxt.next_due.isoformat()} if nxt else None),
    }


def xp_total(db: Session, user_id: str) -> int:
    activities = db.query(Activity).filter_by(user_id=user_id).all()
    total = sum(a.xp for a in activities)
    # Existing garages predate the ownership milestone. Count those current
    # vehicles too, without double-counting the new activity record.
    rewarded_models = {a.model_id for a in activities if a.kind == "owned" and a.category == "garage"}
    for v in db.query(Vehicle).filter_by(user_id=user_id, ownership="current").filter(Vehicle.model_id.isnot(None)):
        if v.model_id in rewarded_models:
            continue
        val = latest_valuation(db, v.id)
        m = db.get(CatalogueModel, v.model_id)
        total += value_points(val.high if val else (m.price_high if m else None))
    return total


def level_for(xp: int) -> dict:
    lvl = 1 + xp // 50
    return {"level": lvl, "xp": xp, "next_at": lvl * 50, "title": ["Pit Lane Rookie", "Kerb Spotter", "Trail Scout", "Road Captain",
                                                                  "Apex Hunter", "Motorhead"][min(lvl - 1, 5)]}


def badges_by_model(db: Session, user_id: str | None) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    if not user_id:
        return out
    for a in db.query(Activity).filter_by(user_id=user_id):
        # Keep the meaningful experience on the card: "Drove" is more useful
        # than a catch-all "Experienced" label when scanning Explore.
        key = a.category if a.kind == "experienced" and a.category else a.kind
        out.setdefault(a.model_id, set()).add(key)
    for v in db.query(Vehicle).filter(Vehicle.user_id == user_id, Vehicle.model_id.isnot(None)):
        out.setdefault(v.model_id, set()).add("owned" if v.ownership == "current" else "owned_past")
    return out


def collection_progress(db: Session, user_id: str | None) -> dict:
    models = db.query(CatalogueModel).all()
    badges = badges_by_model(db, user_id)
    discovered = {mid for mid, b in badges.items() if b & {"spotted", "experienced", "test_driven", "owned", "owned_past"}}
    segs = []
    for sid, label in SEGMENTS:
        ids = [m.id for m in models if m.segment == sid]
        segs.append({"id": sid, "label": label, "total": len(ids), "discovered": len([i for i in ids if i in discovered])})
    xp = xp_total(db, user_id) if user_id else 0
    return {"discovered": len(discovered), "total": len(models), "segments": segs, **level_for(xp)}


def next_goal(db: Session, user_id: str) -> dict | None:
    g = db.query(Goal).filter_by(user_id=user_id).order_by(Goal.created_at.desc()).first()
    if not g:
        return None
    m = db.get(CatalogueModel, g.target_model_id)
    return {"id": g.id, "label": model_label(m), "price_assumption": g.price_assumption,
            "target_date": g.target_date.isoformat() if g.target_date else None, "savings": g.savings, "monthly": g.monthly}


def roadmap_suggestions(db: Session, user_id: str) -> list[dict]:
    """Offer a useful next step based on the most recently added current vehicle."""
    current = (db.query(Vehicle).filter_by(user_id=user_id, ownership="current")
               .order_by(Vehicle.created_at.desc()).first())
    by_type = {
        # A scooter rider's next practical aspiration: a capable ₹3–4 lakh bike.
        "scooter": ("triumph-speed-400", "triumph-scrambler-400-x", "ktm-390-adventure"),
        # A bike rider's next practical step: an accessible small car.
        "bike": ("maruti-suzuki-swift", "tata-punch", "hyundai-i20"),
        # A car owner can consider a roomier or electric step-up.
        "car": ("hyundai-creta", "tata-nexon-ev", "mahindra-scorpio-n"),
    }
    ids = by_type.get(current.type if current else "", ("maruti-suzuki-swift", "triumph-speed-400", "tata-punch"))
    found = {m.id: m for m in db.query(CatalogueModel).filter(CatalogueModel.id.in_(ids)).all()}
    return [ser_model(found[mid]) for mid in ids if mid in found]


def care_task(db: Session, user_id: str) -> dict | None:
    row = (db.query(CareLog, Vehicle).join(Vehicle, Vehicle.id == CareLog.vehicle_id)
           .filter(CareLog.user_id == user_id, CareLog.next_due.isnot(None), Vehicle.ownership == "current")
           .order_by(CareLog.next_due).first())
    if not row:
        return None
    c, v = row
    m = db.get(CatalogueModel, v.model_id) if v.model_id else None
    return {"vehicle_id": v.id, "vehicle": model_label(m, v), "kind": c.kind, "due": c.next_due.isoformat(),
            "overdue": c.next_due < date.today()}
