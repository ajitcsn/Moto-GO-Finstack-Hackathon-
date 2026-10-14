# Moto Go

**Your automotive life, mapped.**

Moto Go is a product concept for people who want one calm place to manage the vehicles they own, discover what they might own next, and make a well-informed plan to get there.

It combines a personal garage, a vehicle collection, ownership planning, and an intentionally transparent financing journey. The experience is designed around choice: browse without pressure, understand the numbers before acting, and share only the information needed for a specific purpose.

> This repository is a working demo. Every external integration runs in safe mock mode and is visibly marked **Demo**. It never performs a real identity verification, bank connection, credit enquiry, or loan application.

## What is in Moto Go

### A garage that makes ownership clearer

Add and maintain the vehicles in your life. Moto Go brings together an estimated value range, active loan information, equity, care reminders, and a clear status for each vehicle.

### An automotive collection to explore

Browse models, save the ones that catch your eye, and build a record of vehicles you have spotted, ridden, driven, rented, or test-driven. The collection is deliberately separate from borrowing and financial data.

### A path to the next vehicle

Set a goal and compare practical routes: saving, buying used, selling your current vehicle, or financing. The product makes assumptions visible—including the purchase gap, monthly cost, estimated proceeds, and current equity—so a plan is understandable before it is acted on.

### A consent-led finance experience

When someone chooses to explore financing, Moto Go introduces the lender and purpose before asking for information. It guides the applicant through KYC, credit consent, bank linking, documents, offers, the Key Fact Statement, mandate, e-signing, and disbursal.

The demo also shows realistic outcomes: an approval, a request for additional documents, a mismatch that needs attention, or a decline with a clear way to recover and resume.

## Product vision

Vehicle ownership is usually fragmented: service history is in one place, loans in another, listings somewhere else, and the next purchase decision is a collection of tabs, assumptions, and anxiety.

Moto Go imagines a more connected alternative. It should help someone answer questions such as:

- What do I own, and what needs attention?
- What is my current vehicle likely worth?
- If I sell it, what could I realistically afford next?
- What will financing cost, what information is required, and why?
- Where am I in the process—and what happens next?

The long-term goal is not to nudge a person toward a transaction. It is to give people a useful, trustworthy picture of their automotive life and the confidence to choose their next move.

## Built with care for trust

- Vehicle values include their source, range, and “as of” date.
- Unknown debt remains unknown; it is never presented as zero.
- Finance information is not used to award collection progress.
- Consents record the purpose, recipient, text version, and time, and can be withdrawn.
- Sensitive information is encrypted at rest and masked in API responses.
- Authentication uses secure HTTP-only cookies; personal data is not stored in browser storage.
- Every provider interaction is idempotent and every application transition is recorded.

## Try the demo

Moto Go needs **Python 3.11+** and **Node.js 20+**. The default demo uses SQLite and local file storage—no Docker, Postgres, Redis, or cloud account required.

```bash
# Terminal 1 — API at http://localhost:8000 (docs at /docs)
cd api
python -m venv .venv
# Windows: .venv\Scripts\python -m pip install -r requirements.txt
# macOS/Linux:
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 — web app at http://localhost:5173
cd web
npm install
npm run dev
```

For the pilot-shaped stack (Postgres, Redis, MinIO, nginx), run:

```bash
docker compose -f infra/docker-compose.yml up --build
```

Then open <http://localhost:8080>.

### Demo accounts

The OTP for every demo account is `123456`.

| Phone | Account | Suggested exploration |
|---|---|---|
| `9999900001` | Demo Owner | Start in the Garage: a Suzuki Access 125, a small loan, care reminder, and equity range. |
| `9999900002` | Demo Enthusiast | Start with onboarding, explore the collection, create a Road to goal, and try financing. |
| `9999900009` | Demo Ops | View the read-only operations console at `/ops`. |

Any other valid Indian mobile number creates a new demo account.

### A five-minute walkthrough

1. Sign in as **Demo Owner** and visit the Garage.
2. Explore the Hunter 350, then save or spot it.
3. Create a six-month Road to Hunter goal.
4. Compare saving, buying used, selling-and-buying, and financing.
5. Choose **Explore financing** and continue through the guided demo journey.

To experience an additional-document loop, use a loan amount between **₹1,50,001 and ₹2,50,000**. Amounts of **₹1,50,000 or less** receive three demo offers; higher amounts are declined and routed to a recovery screen.

## Architecture

Moto Go is a React + TypeScript frontend and a Python FastAPI backend. The product’s provider boundaries are explicit: each external service is represented by an adapter that can run in mock mode for demos or be replaced with a live, contract-compatible implementation later.

```text
web/       React, TypeScript, Vite, React Query
api/       FastAPI, SQLAlchemy, SQLite by default
infra/     Docker Compose for Postgres, Redis, MinIO, and nginx
```

Core flows include OTP authentication, consent records, garage and collection management, vehicle goals and scenarios, a configurable finance state machine, document uploads, and server-sent application updates.

## Development checks

```bash
# API tests
cd api && .venv/bin/python -m pytest -q

# Frontend type check and end-to-end tests
cd web && npm run typecheck && npm run e2e
```

The end-to-end suite starts an isolated API on port `8100` and web server on port `5180`. Install Playwright’s browser once with `npx playwright install chromium`.

## Important note

Moto Go is a prototype, not a compliance certification or a live lending product. Before any real-world launch, the legal, operational, and technical requirements of the selected lender and jurisdiction must be reviewed and implemented with the relevant partners.
