"""Seeded demo accounts, one per branch. OTP is always 123456 in mock mode."""
from datetime import date, timedelta

from sqlalchemy.orm import Session

from .adapters.mock import MockValuation  # noqa: F401
from .models import Activity, CareLog, LoanSnapshot, Profile, User, Vehicle
from .services import garage

TERMS = "terms-2026-10-01"

ACCOUNTS = {
    "9999900001": dict(name="Demo Owner", role="user", note="Owns an Access 125 on a small loan; has a care reminder"),
    "9999900002": dict(name="Demo Enthusiast", role="user", note="Empty garage, no vehicle: explore and collect"),
    "9999900009": dict(name="Demo Ops", role="ops", note="Read-only ops console"),
}


def seed_demo(db: Session) -> None:
    if db.query(User).filter(User.phone == "9999900001").first():
        return
    from .services.core import record_consent

    for phone, a in ACCOUNTS.items():
        u = User(phone=phone, display_name=a["name"], is_adult=True, role=a["role"])
        db.add(u)
        db.flush()
        db.add(Profile(user_id=u.id, city="Pune", interests=["commute", "touring"], ownership_tags=["own"], story_done=True))
        record_consent(db, u.id, "terms", "Use Moto Go", "Moto Go", TERMS)
        record_consent(db, u.id, "adult", "Over 18", "Moto Go", TERMS)
        if phone == "9999900001":
            v = Vehicle(user_id=u.id, model_id="suzuki-access-125", type="scooter", variant="Disc", year=2021, ownership="current",
                        city="Pune", odometer=24000, condition="good", owners=1, accident_flag=False, modified_flag=False)
            db.add(v)
            db.flush()
            garage.run_valuation(db, v)
            db.add(LoanSnapshot(vehicle_id=v.id, status="active", lender="Sample Bank", principal=18000,
                                statement_date=date.today() - timedelta(days=12), source="user_entered"))
            db.add(CareLog(vehicle_id=v.id, user_id=u.id, kind="General service", date=date.today() - timedelta(days=150),
                           odometer=22500, cost=1800, next_due=date.today() + timedelta(days=21)))
            db.add(Activity(user_id=u.id, model_id="suzuki-access-125", kind="spotted", xp=10))
    db.commit()
