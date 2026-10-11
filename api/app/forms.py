"""Server-side validation generated from the same field spec the client renders (Pydantic v2)."""
from __future__ import annotations

from datetime import date
from typing import Annotated, Any, Callable, Optional

from pydantic import BaseModel, StringConstraints, ValidationError, create_model
from pydantic import Field as PField

PATTERNS = {
    "tel": r"^[6-9][0-9]{9}$",
    "pan": r"^[A-Z]{5}[0-9]{4}[A-Z]$",
    "ifsc": r"^[A-Z]{4}0[A-Z0-9]{6}$",
    "pincode": r"^[0-9]{6}$",
    "account": r"^[0-9]{9,18}$",
    "email": r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
}
UPPER = {"pan", "ifsc"}
FORMAT_MSG = {
    "tel": "Enter a 10-digit Indian mobile number starting with 6-9",
    "pan": "PAN must look like ABCDE1234F",
    "ifsc": "IFSC must look like ABCD0123456",
    "pincode": "Pincode must be 6 digits",
    "account": "Account number must be 9-18 digits",
    "email": "Enter a valid email address",
}


def _annot(f: dict):
    t = f["type"]
    if t in PATTERNS:
        return Annotated[str, StringConstraints(strip_whitespace=True, pattern=PATTERNS[t])]
    if t in ("text", "textarea", "select", "radio", "model", "file"):
        return Annotated[str, StringConstraints(strip_whitespace=True, min_length=f.get("min"), max_length=f.get("max"))]
    if t == "date":
        return date
    if t in ("money", "number"):
        return Annotated[int, PField(ge=f.get("min", 0), le=f.get("max"))]
    if t == "checkbox":
        return bool
    raise ValueError(f"unknown field type {t}")


def build_model(spec: dict) -> type[BaseModel]:
    fields: dict[str, Any] = {}
    for f in spec["fields"]:
        fields[f["name"]] = (Optional[_annot(f)], None)
    return create_model(f"Step_{spec.get('step', 'x')}", **fields)


def visible(f: dict, values: dict) -> bool:
    cond = f.get("show_if")
    return not cond or values.get(cond["field"]) == cond["equals"]


def age_on(d: date, today: date | None = None) -> int:
    today = today or date.today()
    return today.year - d.year - ((today.month, today.day) < (d.month, d.day))


def _norm(spec: dict, raw: dict) -> dict:
    out = {}
    for f in spec["fields"]:
        v = raw.get(f["name"])
        if isinstance(v, str):
            v = v.strip()
            if v == "":
                v = None
            elif f["type"] in UPPER:
                v = v.upper()
        if f["type"] in ("money", "number") and isinstance(v, str):
            try:
                v = int(v.replace(",", ""))
            except ValueError:
                pass
        if f["type"] == "select" and isinstance(v, (int, float)) and not isinstance(v, bool):
            v = str(v)
        out[f["name"]] = v
    return out


def validate(spec: dict, raw: dict, file_check: Callable[[dict, str], str | None] | None = None):
    """Return (clean_values, errors). errors = [{field, message}]."""
    errors: list[dict] = []
    vals = _norm(spec, raw)
    model = build_model(spec)
    clean: dict[str, Any] = {}
    try:
        parsed = model.model_validate({k: v for k, v in vals.items() if v is not None})
        clean = {k: v for k, v in parsed.model_dump().items() if v is not None}
    except ValidationError as e:
        bad = {err["loc"][0] for err in e.errors() if err["loc"]}
        by = {f["name"]: f for f in spec["fields"]}
        for name in bad:
            f = by.get(name, {})
            msg = FORMAT_MSG.get(f.get("type"), f"{f.get('label', name)} is not valid")
            errors.append({"field": name, "message": msg})
        clean = {k: v for k, v in vals.items() if v is not None and k not in bad}
    # stringify dates for JSON storage; keep a date copy for rules
    dates = {k: v for k, v in clean.items() if isinstance(v, date)}
    for k, v in dates.items():
        clean[k] = v.isoformat()
    flagged = {e["field"] for e in errors}

    for f in spec["fields"]:
        name = f["name"]
        if name in flagged or not visible(f, clean):
            continue
        v = clean.get(name)
        if f["type"] == "checkbox":
            if f.get("required", True) and v is not True:
                errors.append({"field": name, "message": "This must be ticked to continue"})
            continue
        if v is None:
            if f.get("required", True):
                errors.append({"field": name, "message": f"{f['label']} is required"})
            continue
        if f["type"] == "select" and f.get("options") and v not in [o["value"] for o in f["options"]]:
            errors.append({"field": name, "message": "Choose one of the listed options"})
        if f["type"] == "radio" and f.get("options") and v not in [o["value"] for o in f["options"]]:
            errors.append({"field": name, "message": "Choose one of the listed options"})
        if f["type"] == "file" and file_check:
            msg = file_check(f, v)
            if msg:
                errors.append({"field": name, "message": msg})

    flagged = {e["field"] for e in errors}
    for r in spec.get("rules", []):
        if r["type"] == "sum_equals":
            a, b, t = (clean.get(x) for x in (*r["fields"], r["target"]))
            if None in (a, b, t) or any(x in flagged for x in (*r["fields"], r["target"])):
                continue
            if abs((a + b) - t) > t * r.get("tolerance", 0):
                errors.append({"field": r["fields"][0], "message": r["message"]})
        elif r["type"] == "age_range":
            d = dates.get(r["field"])
            if d is None and isinstance(clean.get(r["field"]), str):
                try:
                    d = date.fromisoformat(clean[r["field"]])
                except ValueError:
                    d = None
            if d and r["field"] not in flagged:
                if not (r["min"] <= age_on(d) <= r["max"]):
                    errors.append({"field": r["field"], "message": r["message"]})
    return clean, errors
