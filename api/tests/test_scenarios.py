import pytest

from app.scenarios import apr_pct, build_scenarios, emi, equity_range, purchase_gap, sale_proceeds
from app.state_machine import STATES, InvalidTransition, can_transition, check


def test_emi_reducing_balance():
    assert emi(100000, 12, 12) == 8885  # standard 1L @12% / 12m
    assert emi(12000, 0, 12) == 1000
    assert emi(0, 10, 12) == 0
    with pytest.raises(ValueError):
        emi(1000, 10, 0)


def test_prd_worked_example():
    eq = equity_range(62000, 62000, "active", 18000)
    assert eq["low"] == eq["high"] == 44000
    proceeds = sale_proceeds(62000, 18000, 3000)
    assert proceeds == 41000
    assert purchase_gap(180000, 0, 20000, proceeds) == 119000
    assert purchase_gap(180000, 0, 20000, None) == 160000


def test_unknown_debt_is_unknown_not_zero():
    eq = equity_range(60000, 70000, "unknown", None)
    assert eq["known"] is False and eq["low"] is None
    assert equity_range(60000, 70000, "none", None)["low"] == 60000
    assert equity_range(None, None, "none", None)["known"] is False


def test_negative_equity_flagged():
    eq = equity_range(30000, 40000, "active", 50000)
    assert eq["known"] and eq["negative"] and eq["high"] == -10000


def test_apr_includes_fees():
    e = emi(100000, 12, 12)
    assert apr_pct(100000, 0, e, 12) == pytest.approx(12.0, abs=0.05)
    assert apr_pct(100000, 1000, e, 12) > 12.0


def test_scenarios_never_pick_a_winner():
    out = build_scenarios(price=180000, savings=20000, monthly=10000, sale_estimate=62000, settlement=18000)
    ids = [s["id"] for s in out["scenarios"]]
    assert ids == ["save", "used", "sell_buy", "finance"]
    assert out["scenarios"][0]["months"] == 16
    assert out["scenarios"][2]["gap"] == 119000
    assert not any("best" in s or "cheapest" in s for s in out["scenarios"])
    assert all(s["assumptions"] or s.get("unavailable") for s in out["scenarios"])


def test_sell_unavailable_without_known_loan():
    out = build_scenarios(price=100000, savings=0, monthly=0)
    assert out["scenarios"][2].get("unavailable")


def test_state_machine():
    assert can_transition("draft", "consented")
    assert can_transition("underwriting", "more_info") and can_transition("more_info", "underwriting")
    assert not can_transition("draft", "offered")
    assert not can_transition("disbursed", "declined")
    for s in STATES[:-1]:
        assert can_transition(s, "declined") and can_transition(s, "error")
    with pytest.raises(InvalidTransition):
        check("offered", "signed")
