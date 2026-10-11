"""Lender-configurable finance step schemas (F01-F15).

The API returns the active schema per application and both the client (Zod) and the server
(Pydantic, see forms.py) are built from it, so no field is hard-coded in the UI.
"""
from __future__ import annotations

from copy import deepcopy

LENDER = {
    "id": "demo-nbfc",
    "name": "Demo Finance Co. (sample NBFC)",
    "max_age": 60,
    "min_age": 18,
    "tenures": [12, 18, 24, 30, 36, 48],
    "supported_applicants": ["salaried"],
    "supported_vehicle_types": ["bike", "scooter"],
    "kyc_methods": [
        {"value": "pan_ckyc", "label": "PAN + CKYC lookup"},
        {"value": "digilocker", "label": "DigiLocker"},
        {"value": "video_kyc", "label": "Video KYC (selfie check)"},
    ],
    "statement_months": 6,
    "cooling_off_days": 3,
    "grievance_officer": "Grievance Officer, Demo Finance Co. · grievance@demo-finance.example · 1800-000-0000",
    "retention": "Application documents are kept for 8 years, then purged (sample policy).",
}

STEP_ORDER = ["intake", "identity", "kyc", "bureau", "evidence", "work", "vehicle"]
STEP_SCREEN = {"intake": "F01", "identity": "F02", "kyc": "F03", "bureau": "F05", "evidence": "F07",
               "work": "F08", "vehicle": "F09", "mandate": "F14", "esign": "F15"}


def _consent(ctype: str, purpose: str, version: str) -> dict:
    return {"type": ctype, "purpose": purpose, "recipient": LENDER["name"], "version": version}


def _spec() -> dict[str, dict]:
    lender = LENDER["name"]
    return {
        "intake": {
            "title": "Tell us about the vehicle you want to finance",
            "intro": f"This is a request to {lender} for a two-wheeler loan. Nothing is checked yet.",
            "purpose": "Create a loan application",
            "fields": [
                {"name": "model_id", "label": "Vehicle", "type": "model", "help": "Two-wheelers only for now."},
                {"name": "new_or_used", "label": "New or used", "type": "select",
                 "options": [{"value": "new", "label": "New"}, {"value": "used", "label": "Used"}]},
                {"name": "city", "label": "City of registration", "type": "text", "min": 2, "max": 60},
                {"name": "quote", "label": "On-road price quote (₹)", "type": "money", "min": 20000, "max": 1000000},
                {"name": "amount", "label": "Loan amount (₹)", "type": "money", "min": 10000, "max": 1000000,
                 "help": "Demo: up to ₹1,50,000 is approved, up to ₹2,50,000 asks for more documents, above that is declined."},
                {"name": "contribution", "label": "Your contribution (₹)", "type": "money", "min": 0, "max": 1000000},
                {"name": "tenure", "label": "Tenure (months)", "type": "select",
                 "options": [{"value": str(t), "label": f"{t} months"} for t in LENDER["tenures"]]},
                {"name": "applicant_type", "label": "I am", "type": "select",
                 "options": [{"value": "salaried", "label": "Salaried"},
                             {"value": "self_employed", "label": "Self-employed"},
                             {"value": "student", "label": "A student"},
                             {"value": "other", "label": "Something else"}]},
                {"name": "adult", "label": "I am 18 or older", "type": "checkbox"},
            ],
            "rules": [{"type": "sum_equals", "fields": ["amount", "contribution"], "target": "quote",
                       "tolerance": 0.01, "message": "Loan amount + your contribution must equal the quote (within 1%)."}],
        },
        "identity": {
            "title": "Your details",
            "intro": f"{lender} will use these details to check your identity and eligibility.",
            "purpose": "Identity and eligibility checks for your loan application",
            "fields": [
                {"name": "legal_name", "label": "Legal name (as on PAN)", "type": "text", "min": 2, "max": 80},
                {"name": "dob", "label": "Date of birth", "type": "date"},
                {"name": "address", "label": "Current address", "type": "textarea", "min": 8, "max": 200},
                {"name": "pincode", "label": "Pincode", "type": "pincode"},
                {"name": "pan", "label": "PAN", "type": "pan", "sensitive": True,
                 "help": "Demo: a PAN ending in F verifies; one ending in X triggers a name mismatch. Use sample data only."},
                {"name": "employment", "label": "Employment", "type": "select",
                 "options": [{"value": "private_salaried", "label": "Salaried (private)"},
                             {"value": "government_salaried", "label": "Salaried (government)"}]},
                {"name": "income", "label": "Monthly net income (₹)", "type": "money", "min": 1, "max": 10000000},
                {"name": "existing_emis", "label": "Existing monthly EMIs (₹)", "type": "money", "min": 0, "max": 10000000},
                {"name": "application_consent", "label": f"I agree that {lender} may process these details to assess my loan application.",
                 "type": "checkbox", "consent": _consent("application", "Assess my two-wheeler loan application", "app-consent-v1")},
            ],
            "rules": [{"type": "age_range", "field": "dob", "min": LENDER["min_age"], "max": LENDER["max_age"],
                       "message": f"Applicants must be between {LENDER['min_age']} and {LENDER['max_age']} years old."}],
        },
        "kyc": {
            "title": "Verify your identity",
            "intro": "Choose how you would like to verify. We only ask for what the lender allows.",
            "purpose": "KYC verification",
            "fields": [
                {"name": "kyc_method", "label": "Verification method", "type": "select", "options": LENDER["kyc_methods"]},
                {"name": "retrieval_consent", "label": f"I allow {lender} to retrieve my KYC record from the chosen source.",
                 "type": "checkbox", "consent": _consent("kyc", "Retrieve and verify my KYC record", "kyc-consent-v1")},
                {"name": "address_differs", "label": "My current address differs from my ID address", "type": "checkbox", "required": False},
            ],
            "rules": [],
        },
        "bureau": {
            "title": "Credit report consent",
            "intro": f"{lender} would like to fetch a credit report to assess your application. In this demo it is a sample report, not a real enquiry.",
            "purpose": "Fetch a credit report for this application",
            "fields": [
                {"name": "bureau_consent", "label": f"I agree that {lender} may fetch my credit report for this application only.",
                 "type": "checkbox", "consent": _consent("bureau", "Fetch my credit report to assess this application", "bureau-consent-v1")},
            ],
            "rules": [],
        },
        "evidence": {
            "title": "Income evidence",
            "intro": "Pick one route. Linking via Account Aggregator avoids uploading statements.",
            "purpose": "Verify income",
            "fields": [
                {"name": "route", "label": "How would you like to share income evidence?", "type": "radio",
                 "options": [{"value": "aa", "label": "Link my bank (Account Aggregator)"},
                             {"value": "statements", "label": f"Upload last {LENDER['statement_months']} months of bank statements"}]},
                {"name": "aa_consent", "label": f"I consent to share my bank data with {lender} through an Account Aggregator, for income assessment on this application.",
                 "type": "checkbox", "show_if": {"field": "route", "equals": "aa"},
                 "consent": _consent("aa", "Share bank data for income assessment", "aa-consent-v1")},
                {"name": "bank_statements", "label": f"Bank statements (PDF, last {LENDER['statement_months']} months)", "type": "file",
                 "doc_kind": "bank_statement", "show_if": {"field": "route", "equals": "statements"}},
            ],
            "rules": [],
        },
        "work": {
            "title": "Work details",
            "intro": "A few details about your employer.",
            "purpose": "Verify employment and income",
            "fields": [
                {"name": "employer", "label": "Employer name", "type": "text", "min": 2, "max": 80},
                {"name": "tenure_months", "label": "Months with this employer", "type": "number", "min": 0, "max": 600},
                {"name": "salary_slip", "label": "Latest salary slip", "type": "file", "doc_kind": "salary_slip"},
                {"name": "explanation", "label": "Anything we should know? (optional)", "type": "textarea", "required": False, "max": 300},
            ],
            "rules": [],
        },
        "vehicle": {
            "title": "Vehicle and seller",
            "intro": "The loan is paid to the dealer, not to you.",
            "purpose": "Confirm the vehicle and seller",
            "fields": [
                {"name": "dealer", "label": "Dealer name", "type": "text", "min": 2, "max": 80},
                {"name": "variant", "label": "Variant", "type": "text", "min": 1, "max": 60},
                {"name": "quote_document", "label": "Dealer quote", "type": "file", "doc_kind": "dealer_quote"},
                {"name": "contribution_source", "label": "Where will your contribution come from? (optional)", "type": "text",
                 "required": False, "max": 120},
            ],
            "rules": [],
        },
        "mandate": {
            "title": "Set up repayments",
            "intro": "Authorise EMIs from your bank account (UPI AutoPay / e-NACH). You can cancel with your bank.",
            "purpose": "Register a repayment mandate",
            "fields": [
                {"name": "account_holder", "label": "Account holder name", "type": "text", "min": 2, "max": 80},
                {"name": "account_no", "label": "Account number", "type": "account", "sensitive": True},
                {"name": "ifsc", "label": "IFSC", "type": "ifsc"},
                {"name": "mandate_authorisation", "label": f"I authorise {lender} to debit my account for EMIs as per the agreement.",
                 "type": "checkbox", "consent": _consent("mandate", "Debit EMIs from my bank account", "mandate-consent-v1")},
            ],
            "rules": [],
        },
        "esign": {
            "title": "Review and sign",
            "intro": "Read the agreement, then sign with an Aadhaar-OTP e-sign (sample in this demo).",
            "purpose": "Sign the loan agreement",
            "fields": [
                {"name": "agreement_read", "label": "I have read the loan agreement and the Key Facts Statement.", "type": "checkbox"},
            ],
            "rules": [],
        },
    }


def get_step_spec(step: str) -> dict | None:
    s = _spec().get(step)
    if not s:
        return None
    s = deepcopy(s)
    s["step"] = step
    s["screen"] = STEP_SCREEN.get(step)
    s["lender"] = {"id": LENDER["id"], "name": LENDER["name"]}
    for f in s["fields"]:
        f.setdefault("required", True)
    return s


def all_steps() -> list[str]:
    return list(_spec().keys())
