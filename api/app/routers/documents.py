from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import adapters
from ..config import settings
from ..db import get_db
from ..doc_kinds import APPLICATION_KINDS, KINDS
from ..errors import ApiError
from ..models import Application, Document, Requirement, User, Vehicle
from ..security import current_user
from ..services import core, finance
from ..workers.documents import process_document

router = APIRouter(tags=["documents"])


class PresignIn(BaseModel):
    kind: str
    mime: str
    size: int = Field(gt=0)
    sha256: str = Field(pattern="^[0-9a-f]{64}$")
    filename: str = Field("", max_length=255)
    application_id: str | None = None
    requirement_id: str | None = None
    vehicle_id: str | None = None


def _own(db: Session, user: User, doc_id: str) -> Document:
    d = db.get(Document, doc_id)
    if not d or d.owner_id != user.id:
        raise ApiError("not_found", "Document not found.", 404)
    return d


@router.post("/documents/presign", status_code=201)
def presign(body: PresignIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    k = KINDS.get(body.kind)
    if not k:
        raise ApiError("validation_error", "Unknown document type.", 422, field="kind")
    if body.mime not in k["mimes"]:
        allowed = ", ".join(m.split("/")[1].upper() for m in k["mimes"])
        raise ApiError("validation_error", f"This document must be one of: {allowed}.", 422, field="mime")
    if body.size > settings.max_upload_bytes:
        raise ApiError("validation_error", "Files can be at most 10 MB.", 422, field="size")
    if body.application_id:
        app = finance.get_app(db, user.id, body.application_id)
        if db.query(Document).filter_by(application_id=app.id).count() >= settings.max_docs_per_application:
            raise ApiError("limit_reached", "This application has reached its upload limit.", 429)
    if body.requirement_id:
        req = db.get(Requirement, body.requirement_id)
        if not req or not body.application_id or req.application_id != body.application_id:
            raise ApiError("not_found", "Requirement not found.", 404)
        if body.kind not in finance.ACCEPTS.get(req.kind, [req.kind]):
            raise ApiError("validation_error", "That document type doesn't satisfy this item.", 422, field="kind")
    if body.vehicle_id:
        v = db.get(Vehicle, body.vehicle_id)
        if not v or v.user_id != user.id:
            raise ApiError("not_found", "Vehicle not found.", 404)
    d = Document(owner_id=user.id, application_id=body.application_id, vehicle_id=body.vehicle_id,
                 requirement_id=body.requirement_id, kind=body.kind, filename=body.filename, mime=body.mime,
                 size=body.size, sha256=body.sha256, status="uploading")
    db.add(d)
    db.flush()
    d.storage_key = f"{user.id}/{d.id}"
    up = adapters.get("storage").presign_put(key=d.storage_key, mime=d.mime, size=d.size)
    db.commit()
    return {"document_id": d.id, "upload": up}


@router.put("/storage/put")
async def storage_put(request: Request, key: str, exp: int, sig: str):
    """Local stand-in for a presigned S3 PUT (CSRF-exempt: authorised by the signed URL)."""
    st = adapters.get("storage")
    if not hasattr(st, "verify") or not st.verify(key, exp, sig):
        raise ApiError("forbidden", "This upload link has expired. Start the upload again.", 403, retryable=True)
    data = await request.body()
    if len(data) > settings.max_upload_bytes:
        raise ApiError("validation_error", "Files can be at most 10 MB.", 413)
    st.write(key, data)
    return {"ok": True}


@router.post("/documents/{doc_id}/complete")
def complete(doc_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    import hashlib

    d = _own(db, user, doc_id)
    if d.status != "uploading":
        return finance.ser_doc(d)
    st = adapters.get("storage")
    if not st.exists(d.storage_key):
        raise ApiError("upload_missing", "The file didn't arrive. Please try the upload again.", 409, retryable=True)
    data = st.read(d.storage_key)
    if len(data) != d.size or hashlib.sha256(data).hexdigest() != d.sha256:
        st.delete(d.storage_key)
        raise ApiError("hash_mismatch", "The upload was corrupted in transit. Please try again.", 422, retryable=True)
    d.status = "processing"
    core.track("document_uploaded", doc=d.id, kind=d.kind)
    core.run_job(db, process_document, d.id, delay=core.mock_delay() if adapters.is_mock("docparser") else 0)
    db.commit()
    return finance.ser_doc(d)


@router.get("/documents/{doc_id}")
def get_doc(doc_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return finance.ser_doc(_own(db, user, doc_id))


@router.delete("/documents/{doc_id}", status_code=204)
def delete_doc(doc_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    d = _own(db, user, doc_id)
    if d.application_id:
        app = db.get(Application, d.application_id)
        if app and app.state not in ("draft", "consented", "identity_pending", "evidence_pending", "more_info"):
            raise ApiError("retention", "This document is part of a submitted application and is kept under the lender's retention rules.", 409)
    for k in (d.storage_key, d.redacted_key):
        if k:
            adapters.get("storage").delete(k)
    db.delete(d)
    db.commit()
