PDF = "application/pdf"
JPG = "image/jpeg"
PNG = "image/png"
HEIC = "image/heic"

KINDS: dict[str, dict] = {
    "rc": {"label": "Registration certificate", "mimes": [PDF, JPG, PNG], "retention_days": 30},
    "loan_statement": {"label": "Loan statement", "mimes": [PDF, JPG, PNG], "retention_days": 30},
    "care_bill": {"label": "Service bill", "mimes": [PDF, JPG, PNG], "retention_days": 365},
    "pan_card": {"label": "PAN card", "mimes": [PDF, JPG, PNG], "retention_days": 2920},
    "address_proof": {"label": "Address proof", "mimes": [PDF, JPG, PNG], "retention_days": 2920},
    "selfie": {"label": "Selfie", "mimes": [JPG, PNG, HEIC], "retention_days": 2920},
    "bank_statement": {"label": "Bank statement", "mimes": [PDF], "retention_days": 2920},
    "salary_slip": {"label": "Salary slip", "mimes": [PDF, JPG, PNG], "retention_days": 2920},
    "dealer_quote": {"label": "Dealer quote", "mimes": [PDF, JPG, PNG], "retention_days": 2920},
}

APPLICATION_KINDS = {"pan_card", "address_proof", "selfie", "bank_statement", "salary_slip", "dealer_quote"}

MAGIC = {
    PDF: lambda b: b[:4] == b"%PDF",
    JPG: lambda b: b[:3] == b"\xff\xd8\xff",
    PNG: lambda b: b[:8] == b"\x89PNG\r\n\x1a\n",
    HEIC: lambda b: b[4:8] == b"ftyp",
}
