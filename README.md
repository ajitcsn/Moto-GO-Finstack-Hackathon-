# Moto Go

Your automotive life, mapped: a garage you can maintain, a collection you can explore, and a calm, opt-in path to the next vehicle.
React + TypeScript frontend, Python FastAPI backend, every outside service behind a mock-or-live adapter.
This repo implements the **hackathon scope (P0)** of the PRD, plus the P1 items that were cheap (care log, profile/consents, ops console).

> Every integration runs through a mock adapter and shows a **Demo** badge. No real identity data, no credit enquiries.

## Run it

Needs Python 3.11+ and Node 20+. No Docker, Postgres, Redis or S3 needed for the demo (SQLite + local file storage).

```bash
# 1. API  (http://localhost:8000, docs at /docs)
cd api
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # Windows;  .venv/bin/python on macOS/Linux
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000

# 2. Web  (http://localhost:5173, proxies /api to :8000)
cd web
npm install
npm run dev
```

Pilot-shaped stack (Postgres 16, Redis, MinIO, nginx): `docker compose -f infra/docker-compose.yml up --build`, then open <http://localhost:8080>.

### Demo accounts (OTP is always `123456`)

| Phone | Who | Use it for |
|---|---|---|
| `9999900001` | Demo Owner | Suzuki Access 125 on a small loan, a care reminder, equity range |
| `9999900002` | Demo Enthusiast | Empty garage: onboarding, collection, Road-to, finance |
| `9999900009` | Demo Ops | Read-only ops console at `/ops` |

Any other valid Indian mobile number creates a new account.

### Steering the finance demo

| You enter | Outcome |
|---|---|
| Loan amount ≤ ₹1,50,000 | Approved, then 3 offers |
| ₹1,50,001 – ₹2,50,000 | Lender asks for salary slip + address proof (the F11 loop), then approves |
| Above ₹2,50,000 | Declined, lands on the shared recovery screen (X01) |
| PAN ending `F` (any letter other than `X`) | KYC verifies |
| PAN ending `X` | Name mismatch: asks for a PAN card upload (F04) |
| KYC method "Video KYC" | Also asks for a selfie (F04) |
| Upload filename contains `blurry` / `expired` / `wrongtype` | Rejected with a reason and alternatives |
| Upload filename contains `mismatch` | Needs attention (name does not match), requirement stays open |
| Applicant type other than "Salaried", or a car | Blocked at F01 → X01 |
| "No thanks" on the credit report consent | X01 with "Resume at the credit report step" |

### Five-minute demo path

Sign in as **Demo Owner** → Garage shows the Access with value range, loan and equity (source, confidence, as-of) → Explore, spot/save the Hunter 350 → Roadmap, set a 6-month Road to Hunter → compare saving, used, sell-and-buy and financing → **Explore financing** → complete KYC, credit consent, bank link (Demo AA), work and dealer quote → force one missing-document loop (amount ₹2,00,000) → compare offers, read the KFS, accept → mandate, e-sign → disbursal → back in the Garage the Hunter shows **delivery pending**.

## Tests

```bash
cd api && .venv/Scripts/python -m pytest -q          # 36 tests: scenario maths, state machine, adapter contracts, API, finance flows
cd web && npm run typecheck && npm run e2e           # Playwright: guest explore, onboarding, happy path, F11 loop, declined, consent decline
```

The e2e suite starts its own API (port 8100, fresh DB) and web server (port 5180). Run `npx playwright install chromium` once.

## How it is built

```
moto-go/
  api/                  FastAPI service
    app/routers/        auth, users (me/consents/export), garage, explore (catalogue/collection/goals), applications, documents, misc (webhooks/ops/mock provider)
    app/adapters/       base.py (Protocols) · mock.py · live.py (shells) · __init__.py (ADAPTER_<NAME>=mock|live)
    app/services/       finance.py (state machine orchestration) · garage.py · core.py (consents, events, idempotency, jobs)
    app/workers/        documents.py (the upload pipeline)
    app/finance_config.py   lender-configurable step schemas (F01-F15)
    app/forms.py        Pydantic validation generated from that same spec
    app/scenarios.py    EMI, APR, equity, purchase gap, scenarios (pure, unit-tested)
    migrations/         Alembic (initial schema)
  web/src/
    features/           onboarding, garage, explore, roadmap, finance, profile
    components/         DynamicForm (renders any step from its spec), UploadField, AppShell, ui kit
    lib/                zodFromSpec (client schema from the same spec), upload engine, ₹ formatting
  infra/docker-compose.yml
```

Key decisions:

- **Finance forms come from config.** `GET /applications/{id}/steps/{step}/schema` returns the field list, consents and cross-field rules. The browser builds a Zod schema from it; the server builds Pydantic from the same spec and validates again. Changing a lender's fields is a backend-only change.
- **Two onboardings.** Consumer onboarding never asks for PAN or consent to a bureau. Finance starts only after "Explore financing", names the lender and purpose first, and asks only for what the lender rules flag as missing.
- **Consents are records**: purpose, recipient, text version, time. Withdrawing one (Profile) blocks later provider calls for that purpose (the underwriting job re-checks).
- **State machine** in `state_machine.py`, every transition written to `events` and streamed over SSE. Provider timeouts are `ProviderPending`, never a blank screen.
- **Uploads**: client check and SHA-256 → presigned PUT → `complete` verifies the hash → worker does magic-byte/PDF-password/image checks, metadata strip, parse, name match → `verified | needs_attention | rejected`. Mock mode scripts outcomes by filename after a short delay.
- **Security**: httpOnly SameSite=Lax cookies (access 15 min + refresh), double-submit CSRF token on writes, PAN and account numbers encrypted with Fernet at field level and masked in every API response, all queries scoped by `user_id`, ops console role-gated and audit-logged, OTP rate limits and 3-strikes lock, HMAC-verified webhooks with replay protection, `Idempotency-Key` on provider-calling writes. No PII in browser storage (the upload queue holds file names and status only).
- **No XP for borrowing.** Collection XP: spotted +10, ridden/driven/rented +25, test-driven +25, once per model (and category); saving and past ownership earn nothing; finance data never touches the collection.
- **Values carry source, range and as-of.** Unknown debt means equity unknown, never zero; negative equity is shown as an extra funding need.

### Going live

Flip an adapter with `ADAPTER_KYC=live` etc. The live classes in `app/adapters/live.py` are shells that raise `ProviderNotConfigured` until the FinStack/lender credentials and contracts exist; the contract tests in `api/tests/test_adapters.py` are written to run against both implementations. Swap the in-process job runner (`services/core.run_job`) for RQ/Celery with the same signature, and `ADAPTER_STORAGE=s3` (boto3) for presigned S3 PUTs.

## Deliberate differences from the PRD

- Python 3.11 is what was available here (3.12 is fine). SQLite/local disk by default; Postgres 16, MinIO and Redis are wired in the compose file and supported by config.
- The in-process worker replaces Celery/RQ, and pypdf + Pillow replace pdfplumber/PyMuPDF/Tesseract. Malware scanning (ClamAV) and OCR are marked "skipped/mock" in the pipeline.
- The TypeScript API client is hand-written (`web/src/api/types.ts`) instead of generated from OpenAPI.
- Capture is P0 manual-pick only: the photo is previewed on device and never uploaded; server-side redaction is not built.
- Experiences is the static partner-handoff screen, with no invented bookings.
- Not built: P2 items, Hindi strings, Sentry, reminders delivery, scheduled retention purge (the `purge_expired` job exists, but nothing schedules it).

*This is a demo and not a compliance certification. RBI Digital Lending obligations (KFS before acceptance, named lender, cooling-off, grievance officer, no pass-through of funds) are reflected in the UX, but must be mapped with the chosen lender before any pilot.*
