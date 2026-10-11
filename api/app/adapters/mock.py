"""Mock adapters: scripted, deterministic, no real identity data or credit enquiries."""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
import time
from datetime import date, timedelta
from pathlib import Path

from ..config import settings
from ..scenarios import apr_pct, emi
from .base import ParseResult, ProviderPending

log = logging.getLogger("motogo.mock")

DEMO_OTP = "123456"


class MockOtp:
    def generate(self, identifier: str) -> str:
        return DEMO_OTP

    def deliver(self, identifier: str, code: str) -> None:
        log.warning("[mock-otp] code for %s is %s", identifier, code)


class MockValuation:
    """Seeded depreciation curve. Confidence follows data completeness; spread follows confidence."""

    def estimate(self, *, price_low, price_high, year, odometer, condition, owners, accident, modified, city):
        today = date.today()
        mid_new = (price_low + price_high) / 2
        age = max(0, today.year - year)
        value = mid_new * (0.88 ** age)
        provided = 0
        if odometer is not None:
            expected = age * 9000
            value *= 1 + max(-0.10, min(0.10, -(odometer - expected) / 10000 * 0.015))
            provided += 1
        if condition:
            value *= {"excellent": 1.05, "good": 1.0, "fair": 0.9, "poor": 0.78}.get(condition, 1.0)
            provided += 1
        if owners is not None:
            value *= 1 - 0.03 * max(0, owners - 1)
            provided += 1
        if accident is not None:
            value *= 0.92 if accident else 1.0
            provided += 1
        if modified is not None:
            value *= 0.96 if modified else 1.0
            provided += 1
        value = max(value, mid_new * 0.12)
        confidence = "high" if provided >= 5 else "medium" if provided >= 3 else "low"
        spread = {"high": 0.07, "medium": 0.12, "low": 0.18}[confidence]
        r = lambda v: int(round(v / 500.0) * 500)  # noqa: E731
        return {"low": r(value * (1 - spread)), "mid": r(value), "high": r(value * (1 + spread)),
                "confidence": confidence, "source": "Demo depreciation curve (not a market quote)",
                "as_of": today}


class MockKyc:
    """PAN ending F verifies; ending X returns a name mismatch."""

    def verify(self, *, pan, legal_name, method, idempotency_key):
        if pan.upper().endswith("X"):
            return {"status": "name_mismatch", "ref": "kyc-" + idempotency_key[:8],
                    "name_on_record": "RECORD NAME DIFFERS"}
        return {"status": "verified", "ref": "kyc-" + idempotency_key[:8], "name_on_record": legal_name.upper()}


class MockBureau:
    def pull(self, *, pan, idempotency_key):
        return {"report_ref": "SAMPLE-BUREAU-" + idempotency_key[:8].upper(), "enquiry": "sample (no real enquiry)",
                "score_band": "sample"}


class MockAA:
    def initiate(self, *, application_id, return_url, idempotency_key):
        handle = "aa-" + idempotency_key[:10]
        return {"consent_handle": handle, "redirect_url": f"/mock/aa?app={application_id}&handle={handle}"}

    def fetch(self, *, consent_handle):
        base = date.today().replace(day=1)
        tx = []
        for m in range(6):
            d = (base - timedelta(days=30 * (m + 1)))
            tx.append({"month": d.strftime("%Y-%m"), "salary_credit": 42000, "closing_balance": 18000 + m * 1500})
        return {"transactions_months": 6, "summary": tx, "sample": True}


class MockDocumentParser:
    """Scripted outcomes by filename keyword; otherwise verified with plausible extracted fields."""

    def parse(self, *, kind, filename, mime, data, context):
        n = filename.lower()
        name = context.get("legal_name") or "Demo Applicant"
        if any(k in n for k in ("blurry", "unreadable", "blur")):
            return ParseResult("rejected", "The image is too blurry to read.",
                               alternatives=["Retake in good light with all four corners visible", "Upload a PDF copy"])
        if "expired" in n:
            return ParseResult("rejected", "The document appears to have expired.",
                               alternatives=["Upload a current document"])
        if "wrongtype" in n or "wrong_type" in n:
            return ParseResult("rejected", f"This does not look like a {kind.replace('_', ' ')}.",
                               alternatives=["Check you picked the right file"])
        if "mismatch" in n:
            return ParseResult("needs_attention", "The name on the document does not match your application.",
                               extracted={"name": "R. KUMAR (mismatch)"},
                               alternatives=["Upload a document showing your legal name",
                                             "Correct the legal name on your application"])
        ex: dict = {"name": name.upper()}
        if kind == "pan_card":
            ex["pan"] = context.get("pan_masked", "XXXXX0000X")
        elif kind == "salary_slip":
            ex.update(employer="DEMO EMPLOYER PVT LTD", net_pay=42000, month=date.today().strftime("%Y-%m"))
        elif kind == "bank_statement":
            ex.update(period_months=6, salary_credits=6)
        elif kind == "dealer_quote":
            ex.update(model=context.get("model"), on_road_price=context.get("quote"))
        elif kind == "loan_statement":
            ex.update(principal=context.get("principal", 18000), statement_date=str(date.today()))
        elif kind == "address_proof":
            ex.update(address="Sample address, matched")
        return ParseResult("verified", extracted=ex)


class MockLender:
    """Decision by requested amount: <= 1.5L approved, <= 2.5L more info (once), above declined."""

    def decide(self, *, application, round, idempotency_key):
        amt = application["amount"]
        if amt > 250_000:
            return {"decision": "declined", "reasons": ["Requested amount is above the sample lender's policy limit."]}
        if amt > 150_000 and round == 1:
            return {"decision": "more_info", "requirements": [
                {"kind": "salary_slip", "reason": "The lender needs your latest salary slip to confirm income.",
                 "alternatives": ["Upload last month's salary slip", "Upload 3 months of bank statements instead"]},
                {"kind": "address_proof", "reason": "The current address could not be matched to your KYC record.",
                 "alternatives": ["Upload a recent utility bill", "Upload a rental agreement"]},
            ]}
        return {"decision": "approved"}

    def offers(self, *, application):
        amt, ten = application["amount"], application["tenure"]
        out = []
        for label, tenure, rate, fee_pct, conditional in (
            ("Standard", ten, 12.5, 0.01, False),
            ("Lower EMI", min(ten + 12, 48), 13.5, 0.012, False),
            ("Lowest rate", max(ten - 12, 12), 11.0, 0.015, True),
        ):
            if label == "Lowest rate" and ten <= 12:
                continue
            if label == "Lower EMI" and ten >= 48:
                continue
            e = emi(amt, rate, tenure)
            fees = round(amt * fee_pct)
            out.append({"label": label, "amount": amt, "tenure": tenure, "rate": rate, "emi": e, "fees": fees,
                        "apr": apr_pct(amt, fees, e, tenure), "total": e * tenure + fees, "conditional": conditional,
                        "conditions": ["Subject to verification of the original salary slip"] if conditional else []})
        return out


class MockMandate:
    def register(self, *, application_id, ifsc, idempotency_key):
        return ProviderPending(ref="mandate-" + idempotency_key[:8], message="Waiting for your bank to confirm the mandate.")


class MockEsign:
    def initiate(self, *, application_id, return_url, idempotency_key):
        ref = "esign-" + idempotency_key[:10]
        return {"ref": ref, "redirect_url": f"/mock/esign?app={application_id}&ref={ref}"}

    def complete(self, *, application_id, ref):
        return {"signed_ref": "SIGNED-" + ref.upper(), "document": "signed-agreement-stub.pdf"}


class LocalStorage:
    """Stands in for S3/MinIO: files live on disk and the 'presigned' URL points back at this API."""

    def __init__(self):
        self.root = Path(settings.storage_dir)
        self.root.mkdir(parents=True, exist_ok=True)

    def _sig(self, key: str, exp: int) -> str:
        return hmac.new(settings.secret_key.encode(), f"{key}:{exp}".encode(), hashlib.sha256).hexdigest()[:32]

    def verify(self, key: str, exp: int, sig: str) -> bool:
        return exp > time.time() and hmac.compare_digest(self._sig(key, exp), sig)

    def presign_put(self, *, key, mime, size):
        exp = int(time.time()) + 300
        return {"url": f"{settings.public_api_url.rstrip('/')}/api/v1/storage/put?key={key}&exp={exp}&sig={self._sig(key, exp)}",
                "method": "PUT", "headers": {"Content-Type": mime}, "expires_in": 300}

    def _p(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if not str(p).startswith(str(self.root.resolve())):
            raise ValueError("bad key")
        return p

    def exists(self, key):
        return self._p(key).is_file()

    def read(self, key):
        return self._p(key).read_bytes()

    def write(self, key, data):
        p = self._p(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    def delete(self, key):
        try:
            os.remove(self._p(key))
        except FileNotFoundError:
            pass


PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
