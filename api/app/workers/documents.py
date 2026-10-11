"""Document pipeline: type check -> strip -> extract -> match. Status goes to the UI via polling and SSE."""
from __future__ import annotations

import difflib
import io
import logging
from datetime import timedelta

from PIL import Image
from pypdf import PdfReader
from sqlalchemy.orm import Session

from .. import adapters
from ..db import utcnow
from ..doc_kinds import APPLICATION_KINDS, KINDS, MAGIC
from ..models import ApplicationStep, Document, Requirement
from ..services import core

log = logging.getLogger("motogo.docs")


def _context(db: Session, doc: Document) -> dict:
    ctx: dict = {}
    if doc.application_id:
        step = db.get(ApplicationStep, (doc.application_id, "identity"))
        if step:
            ctx["legal_name"] = step.payload_json.get("legal_name")
        from ..models import Application

        app = db.get(Application, doc.application_id)
        if app:
            ctx["quote"] = app.quote
            ctx["model"] = app.model_id
    return ctx


def _finish(db: Session, doc: Document, status: str, reason: str | None, extracted: dict | None = None,
            alternatives: list[str] | None = None) -> None:
    doc.status, doc.reason = status, reason
    if extracted is not None:
        doc.extracted_json = {**doc.extracted_json, **extracted}
    doc.retention_until = utcnow() + timedelta(days=KINDS[doc.kind]["retention_days"])
    core.track("document_result", doc=doc.id, kind=doc.kind, status=status)
    if doc.application_id:
        from ..services import finance

        label = KINDS[doc.kind]["label"]
        finance.on_document_result(db, doc, f"{label}: {status.replace('_', ' ')}", alternatives or [])


def process_document(db: Session, doc_id: str) -> None:
    doc = db.get(Document, doc_id)
    if not doc or doc.status not in ("processing", "uploaded"):
        return
    storage = adapters.get("storage")
    try:
        data = storage.read(doc.storage_key)
    except Exception:  # noqa: BLE001
        return _finish(db, doc, "rejected", "We couldn't read the uploaded file. Please upload it again.")

    checks: dict = {"malware_scan": "skipped (ClamAV not configured in this environment)"}
    if not MAGIC[doc.mime](data):
        return _finish(db, doc, "rejected", "The file contents don't match its type. Upload a real PDF, JPG or PNG.")

    if doc.mime == "application/pdf":
        try:
            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted:
                return _finish(db, doc, "rejected", "This PDF is password protected. Remove the password and upload again.")
            checks["pages"] = len(reader.pages)
        except Exception:  # noqa: BLE001
            return _finish(db, doc, "rejected", "We couldn't open this PDF. It may be damaged.")
    elif doc.mime in ("image/jpeg", "image/png"):
        try:
            img = Image.open(io.BytesIO(data))
            img.verify()
            img = Image.open(io.BytesIO(data))
            checks["dimensions"] = list(img.size)
            clean = Image.new(img.mode, img.size)  # strips EXIF/GPS by rebuilding from pixels only
            clean.putdata(list(img.getdata()))
            buf = io.BytesIO()
            clean.save(buf, format="JPEG" if doc.mime == "image/jpeg" else "PNG")
            doc.redacted_key = doc.storage_key + ".clean"
            storage.write(doc.redacted_key, buf.getvalue())
            checks["metadata_stripped"] = True
        except Exception:  # noqa: BLE001
            return _finish(db, doc, "rejected", "We couldn't read this image. Try a clearer photo.")

    ctx = _context(db, doc)
    res = adapters.get("docparser").parse(kind=doc.kind, filename=doc.filename, mime=doc.mime, data=data, context=ctx)
    extracted = {**res.extracted, "checks": checks}
    status, reason = res.outcome, res.reason

    legal = ctx.get("legal_name")
    got = res.extracted.get("name")
    if status == "verified" and legal and got and doc.kind in ("pan_card", "salary_slip", "address_proof"):
        ratio = difflib.SequenceMatcher(None, legal.lower(), got.lower()).ratio()
        extracted["name_match"] = round(ratio, 2)
        if ratio < 0.8:
            status, reason = "needs_attention", "The name on the document doesn't match your application."

    # raw uploads that no application needs are removed once processed; the sanitised copy stays
    if not doc.application_id and doc.redacted_key:
        storage.delete(doc.storage_key)
        doc.storage_key, doc.redacted_key = doc.redacted_key, None
    _finish(db, doc, status, reason, extracted, res.alternatives)


def purge_expired(db: Session) -> int:
    """Scheduled retention job: delete documents past retention_until."""
    storage = adapters.get("storage")
    n = 0
    for doc in db.query(Document).filter(Document.retention_until.isnot(None), Document.retention_until < utcnow()):
        for k in (doc.storage_key, doc.redacted_key):
            if k:
                storage.delete(k)
        db.delete(doc)
        n += 1
    db.commit()
    return n
