import hashlib
import io
import os
import tempfile
from urllib.parse import urlparse

_tmp = tempfile.mkdtemp(prefix="mf-test-")
os.environ.update(
    DATABASE_URL=f"sqlite:///{_tmp}/test.db", STORAGE_DIR=f"{_tmp}/files", SYNC_JOBS="true",
    MOCK_DELAY_MIN="0", MOCK_DELAY_MAX="0", SECRET_KEY="test-secret", WEBHOOK_SECRET="test-hook",
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from pypdf import PdfWriter  # noqa: E402

from app.main import app  # noqa: E402


def make_pdf() -> bytes:
    w = PdfWriter()
    w.add_blank_page(200, 200)
    b = io.BytesIO()
    w.write(b)
    return b.getvalue()


class Api:
    def __init__(self, client: TestClient):
        self.c = client

    def _h(self, extra=None):
        h = {"x-csrf-token": self.c.cookies.get("mf_csrf", "")}
        h.update(extra or {})
        return h

    def get(self, p, **k):
        return self.c.get("/api/v1" + p, **k)

    def post(self, p, json=None, headers=None):
        return self.c.post("/api/v1" + p, json=json, headers=self._h(headers))

    def put(self, p, json=None, headers=None):
        return self.c.put("/api/v1" + p, json=json, headers=self._h(headers))

    def patch(self, p, json=None):
        return self.c.patch("/api/v1" + p, json=json, headers=self._h())

    def delete(self, p):
        return self.c.delete("/api/v1" + p, headers=self._h())

    def login(self, phone="9999900001", name="Test User"):
        self.post("/auth/otp/request", {"identifier": phone})
        r = self.post("/auth/otp/verify", {"identifier": phone, "code": "123456", "display_name": name,
                                            "adult": True, "accept_terms": True})
        assert r.status_code == 200, r.text
        return r.json()

    def upload(self, kind, filename="doc.pdf", app_id=None, requirement_id=None, data=None, mime="application/pdf"):
        data = data or make_pdf()
        r = self.post("/documents/presign", {"kind": kind, "mime": mime, "size": len(data),
                                             "sha256": hashlib.sha256(data).hexdigest(), "filename": filename,
                                             "application_id": app_id, "requirement_id": requirement_id})
        assert r.status_code == 201, r.text
        j = r.json()
        u = urlparse(j["upload"]["url"])
        put = self.c.put(u.path + "?" + u.query, content=data, headers={"content-type": mime})
        assert put.status_code == 200, put.text
        done = self.post(f"/documents/{j['document_id']}/complete")
        assert done.status_code == 200, done.text
        return self.get(f"/documents/{j['document_id']}").json()


@pytest.fixture(scope="session")
def _client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def api(_client):
    _client.cookies.clear()
    from app.db import SessionLocal
    from app.models import OtpChallenge
    from app.routers import auth

    auth._hits.clear()
    with SessionLocal() as db:
        db.query(OtpChallenge).delete()
        db.commit()
    return Api(_client)
