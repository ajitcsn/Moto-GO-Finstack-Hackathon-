"""Pure maths for equity, Road-to gaps, EMI and scenarios. No I/O, easy to unit test."""
from __future__ import annotations

import math


def inr(n: float) -> str:
    """₹ with Indian digit grouping (1,80,000)."""
    s = str(int(round(abs(n))))
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    if head:
        parts.insert(0, head)
    return ("-" if n < 0 else "") + "₹" + ",".join(parts + [tail])


def emi(principal: float, annual_rate_pct: float, months: int) -> int:
    """Reducing-balance EMI: P r (1+r)^n / ((1+r)^n - 1); P/n when r == 0."""
    if months <= 0:
        raise ValueError("months must be positive")
    if principal <= 0:
        return 0
    r = annual_rate_pct / 12 / 100
    if r == 0:
        return round(principal / months)
    f = (1 + r) ** months
    return round(principal * r * f / (f - 1))


def apr_pct(amount: float, fees: float, emi_amount: float, months: int) -> float:
    """APR as the IRR of the net-disbursed cashflows (annualised monthly rate x 12).
    Includes upfront fees, so it is not the nominal rate used in the EMI arithmetic."""
    net = amount - fees
    if net <= 0 or emi_amount <= 0:
        return 0.0
    lo, hi = 0.0, 1.0
    for _ in range(80):
        mid = (lo + hi) / 2
        pv = sum(emi_amount / (1 + mid) ** k for k in range(1, months + 1)) if mid > 0 else emi_amount * months
        if pv > net:
            lo = mid
        else:
            hi = mid
    return round((lo + hi) / 2 * 12 * 100, 2)


def equity_range(val_low: int | None, val_high: int | None, loan_status: str, principal: int | None):
    """Estimated equity = valuation range - outstanding principal.
    Unknown debt means equity is unknown, never zero."""
    if val_low is None or val_high is None:
        return {"known": False, "reason": "no_valuation", "low": None, "high": None}
    if loan_status == "unknown":
        return {"known": False, "reason": "loan_unknown", "low": None, "high": None}
    if loan_status == "active":
        if principal is None:
            return {"known": False, "reason": "loan_unknown", "low": None, "high": None}
        p = principal
    else:
        p = 0
    return {"known": True, "reason": None, "low": val_low - p, "high": val_high - p,
            "negative": val_high - p < 0 or val_low - p < 0}


def sale_proceeds(sale_estimate: int, settlement: int, costs: int) -> int:
    return sale_estimate - settlement - costs


def purchase_gap(target_onroad: int, acquisition_costs: int, savings: int, proceeds: int | None) -> int:
    """Target on-road + disclosed acquisition costs - savings - sale proceeds (only if selling)."""
    return target_onroad + acquisition_costs - savings - (proceeds or 0)


def build_scenarios(
    *,
    price: int,
    savings: int,
    monthly: int,
    acquisition_costs: int = 0,
    sale_estimate: int | None = None,
    settlement: int | None = None,
    sale_costs: int = 3000,
    used_factor: float = 0.65,
    rate_pct: float = 11.5,
    tenures: tuple[int, ...] = (12, 24, 36, 48),
) -> dict:
    """Compare routes on explicit assumptions. Deliberately declares no 'cheapest' route."""
    total_need = price + acquisition_costs
    out: list[dict] = []

    # 1. Save
    gap_keep = purchase_gap(price, acquisition_costs, savings, None)
    months = None if monthly <= 0 else max(0, math.ceil(max(gap_keep, 0) / monthly))
    out.append({
        "id": "save", "title": "Save up",
        "gap": max(gap_keep, 0), "months": months,
        "summary": ("You already cover the cost." if gap_keep <= 0 else
                    f"{months} months at the monthly amount." if months is not None else
                    "Set a monthly amount to see a date."),
        "assumptions": [f"Price stays at {inr(price)} (no price rises)", "No interest earned on savings",
                        f"Acquisition costs {inr(acquisition_costs)}"],
    })

    # 2. Used
    used_price = round(price * used_factor)
    used_gap = purchase_gap(used_price, acquisition_costs, savings, None)
    out.append({
        "id": "used", "title": "Buy used",
        "price": used_price, "gap": max(used_gap, 0),
        "months": None if monthly <= 0 else max(0, math.ceil(max(used_gap, 0) / monthly)),
        "summary": f"A comparable used one at about {round(used_factor * 100)}% of the new price.",
        "assumptions": [f"Used price = {round(used_factor * 100)}% of new (illustrative)",
                        "Condition, history and repair costs are unknown", "Used-vehicle finance is not offered yet"],
    })

    # 3. Sell and buy
    if sale_estimate is not None and settlement is not None:
        proceeds = sale_proceeds(sale_estimate, settlement, sale_costs)
        g = purchase_gap(price, acquisition_costs, savings, proceeds)
        out.append({
            "id": "sell_buy", "title": "Sell and buy",
            "proceeds": proceeds, "gap": max(g, 0), "extra_funding_needed": proceeds < 0,
            "months": None if monthly <= 0 else max(0, math.ceil(max(g, 0) / monthly)),
            "summary": ("Selling leaves you short, so you would need to add funds." if proceeds < 0 else
                        f"Estimated proceeds {inr(proceeds)} after settlement and costs."),
            "assumptions": [f"Sale at the valuation midpoint {inr(sale_estimate)}", f"Loan settlement {inr(settlement)}",
                            f"Selling and transfer costs {inr(sale_costs)}", "You are without this vehicle until the new one arrives"],
        })
    else:
        out.append({
            "id": "sell_buy", "title": "Sell and buy", "unavailable": True,
            "summary": "Needs a valuation and a known loan balance for the vehicle you would sell.",
            "assumptions": [],
        })

    # 4. Finance
    loan = max(total_need - savings, 0)
    options = [{"tenure": n, "emi": emi(loan, rate_pct, n), "interest": emi(loan, rate_pct, n) * n - loan}
               for n in tenures] if loan > 0 else []
    out.append({
        "id": "finance", "title": "Finance part of it",
        "down_payment": min(savings, total_need), "loan": loan, "options": options,
        "summary": "No loan needed." if loan == 0 else f"Borrow {inr(loan)} after putting in your savings.",
        "assumptions": [f"Illustrative rate {rate_pct}% a year, reducing balance",
                        "Real offers come from the lender with fees and APR",
                        "Interest is a cost; compare it with the other routes' waiting and depreciation costs"],
    })
    return {"total_need": total_need, "scenarios": out}
