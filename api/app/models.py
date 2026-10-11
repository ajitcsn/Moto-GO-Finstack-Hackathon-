import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base, utcnow


def uid() -> str:
    return uuid.uuid4().hex


def pk():
    return mapped_column(String(32), primary_key=True, default=uid)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = pk()
    phone: Mapped[str | None] = mapped_column(String(15), unique=True, nullable=True)
    email: Mapped[str | None] = mapped_column(String(254), unique=True, nullable=True)
    display_name: Mapped[str] = mapped_column(String(40))
    is_adult: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[str] = mapped_column(String(10), default="user")  # user | ops
    deletion_requested_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Profile(Base):
    __tablename__ = "profiles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    interests: Mapped[list] = mapped_column(JSON, default=list)
    ownership_tags: Mapped[list] = mapped_column(JSON, default=list)
    public_handle: Mapped[str | None] = mapped_column(String(40), nullable=True)
    story_done: Mapped[bool] = mapped_column(Boolean, default=False)


class OtpChallenge(Base):
    __tablename__ = "otp_challenges"
    identifier: Mapped[str] = mapped_column(String(254), primary_key=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_sent_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Consent(Base):
    __tablename__ = "consents"
    id: Mapped[str] = pk()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    application_id: Mapped[str | None] = mapped_column(ForeignKey("applications.id"), nullable=True, index=True)
    type: Mapped[str] = mapped_column(String(30))  # terms adult marketing application kyc bureau aa mandate kfs
    purpose: Mapped[str] = mapped_column(Text)
    recipient: Mapped[str] = mapped_column(String(120))
    text_version: Mapped[str] = mapped_column(String(40))
    granted_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class CatalogueModel(Base):
    __tablename__ = "catalogue_models"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    type: Mapped[str] = mapped_column(String(10))  # car bike scooter
    make: Mapped[str] = mapped_column(String(60))
    model: Mapped[str] = mapped_column(String(80))
    variant: Mapped[str] = mapped_column(String(80))
    segment: Mapped[str] = mapped_column(String(20))  # commute touring adventure performance ev
    price_low: Mapped[int] = mapped_column(Integer)
    price_high: Mapped[int] = mapped_column(Integer)
    specs: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[str] = mapped_column(String(80), default="Demo seed (illustrative)")
    as_of: Mapped[date] = mapped_column(Date)


class Vehicle(Base):
    __tablename__ = "vehicles"
    id: Mapped[str] = pk()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    model_id: Mapped[str | None] = mapped_column(ForeignKey("catalogue_models.id"), nullable=True)
    free_text_model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    type: Mapped[str] = mapped_column(String(10))
    variant: Mapped[str | None] = mapped_column(String(80), nullable=True)
    year: Mapped[int] = mapped_column(Integer)
    ownership: Mapped[str] = mapped_column(String(10))  # current | past
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    odometer: Mapped[int | None] = mapped_column(Integer, nullable=True)
    condition: Mapped[str | None] = mapped_column(String(12), nullable=True)
    owners: Mapped[int | None] = mapped_column(Integer, nullable=True)
    accident_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    modified_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    rc_document_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    delivery_status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # pending | delivered
    source: Mapped[str] = mapped_column(String(20), default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class LoanSnapshot(Base):
    __tablename__ = "loan_snapshots"
    id: Mapped[str] = pk()
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id"), index=True)
    status: Mapped[str] = mapped_column(String(10))  # none active unknown
    lender: Mapped[str | None] = mapped_column(String(120), nullable=True)
    principal: Mapped[int | None] = mapped_column(Integer, nullable=True)
    statement_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="user_entered")
    document_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Valuation(Base):
    __tablename__ = "valuations"
    id: Mapped[str] = pk()
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id"), index=True)
    low: Mapped[int] = mapped_column(Integer)
    mid: Mapped[int] = mapped_column(Integer)
    high: Mapped[int] = mapped_column(Integer)
    confidence: Mapped[str] = mapped_column(String(10))
    source: Mapped[str] = mapped_column(String(120))
    as_of: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CareLog(Base):
    __tablename__ = "care_logs"
    id: Mapped[str] = pk()
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    date: Mapped[date] = mapped_column(Date)
    odometer: Mapped[int] = mapped_column(Integer)
    cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_due: Mapped[date | None] = mapped_column(Date, nullable=True)
    document_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    remind: Mapped[bool] = mapped_column(Boolean, default=False)


class Activity(Base):
    """Collection milestones. Never fed by, or into, finance data."""

    __tablename__ = "activities"
    __table_args__ = (UniqueConstraint("user_id", "model_id", "kind", "category", name="uq_activity"),)
    id: Mapped[str] = pk()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    model_id: Mapped[str] = mapped_column(ForeignKey("catalogue_models.id"))
    kind: Mapped[str] = mapped_column(String(20))  # spotted saved experienced test_driven
    category: Mapped[str] = mapped_column(String(20), default="")  # ridden driven rented past_owned
    provenance: Mapped[str] = mapped_column(String(20), default="self_reported")
    occurred_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Goal(Base):
    __tablename__ = "goals"
    id: Mapped[str] = pk()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    target_model_id: Mapped[str] = mapped_column(ForeignKey("catalogue_models.id"))
    price_assumption: Mapped[int] = mapped_column(Integer)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    savings: Mapped[int] = mapped_column(Integer, default=0)
    monthly: Mapped[int] = mapped_column(Integer, default=0)
    sell_current: Mapped[str | None] = mapped_column(String(32), nullable=True)  # vehicle id
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[str] = pk()
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    goal_id: Mapped[str | None] = mapped_column(ForeignKey("goals.id"), nullable=True)
    lender_id: Mapped[str] = mapped_column(String(40))
    product: Mapped[str] = mapped_column(String(40), default="two_wheeler")
    state: Mapped[str] = mapped_column(String(24), default="draft")
    current_step: Mapped[str] = mapped_column(String(24), default="identity")
    model_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    amount: Mapped[int] = mapped_column(Integer)
    tenure: Mapped[int] = mapped_column(Integer)
    quote: Mapped[int] = mapped_column(Integer)
    contribution: Mapped[int] = mapped_column(Integer)
    underwriting_round: Mapped[int] = mapped_column(Integer, default=0)
    exit_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    accepted_offer_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mandate_active: Mapped[bool] = mapped_column(Boolean, default=False)
    vehicle_id: Mapped[str | None] = mapped_column(String(32), nullable=True)  # garage handoff
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class ApplicationStep(Base):
    __tablename__ = "application_steps"
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"), primary_key=True)
    step_id: Mapped[str] = mapped_column(String(24), primary_key=True)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft pending_provider submitted
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[str] = pk()
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    application_id: Mapped[str | None] = mapped_column(ForeignKey("applications.id"), nullable=True, index=True)
    vehicle_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    requirement_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    kind: Mapped[str] = mapped_column(String(30))
    filename: Mapped[str] = mapped_column(String(255), default="")
    storage_key: Mapped[str] = mapped_column(String(300), default="")
    mime: Mapped[str] = mapped_column(String(80))
    size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), default="uploading")
    # uploading processing verified needs_attention rejected
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_json: Mapped[dict] = mapped_column(JSON, default=dict)
    redacted_key: Mapped[str | None] = mapped_column(String(300), nullable=True)
    retention_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Requirement(Base):
    __tablename__ = "requirements"
    id: Mapped[str] = pk()
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    category: Mapped[str] = mapped_column(String(14), default="identity")  # identity | underwriting
    reason: Mapped[str] = mapped_column(Text)
    alternatives: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="open")  # open resolved
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Offer(Base):
    __tablename__ = "offers"
    id: Mapped[str] = pk()
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"), index=True)
    lender: Mapped[str] = mapped_column(String(120))
    amount: Mapped[int] = mapped_column(Integer)
    tenure: Mapped[int] = mapped_column(Integer)
    rate: Mapped[float] = mapped_column(Float)  # nominal annual %
    apr: Mapped[float] = mapped_column(Float)
    emi: Mapped[int] = mapped_column(Integer)
    fees: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    conditional: Mapped[bool] = mapped_column(Boolean, default=False)
    conditions: Mapped[list] = mapped_column(JSON, default=list)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    kfs_version: Mapped[str] = mapped_column(String(30), default="kfs-2026-10-v1")


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"), index=True)
    type: Mapped[str] = mapped_column(String(60))
    provider: Mapped[str | None] = mapped_column(String(30), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    payload_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    state: Mapped[str | None] = mapped_column(String(24), nullable=True)
    summary: Mapped[str] = mapped_column(Text, default="")  # human readable, no PII


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    route: Mapped[str] = mapped_column(String(120))
    status_code: Mapped[int] = mapped_column(Integer)
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
