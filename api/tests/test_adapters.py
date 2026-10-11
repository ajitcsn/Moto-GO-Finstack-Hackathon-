"""Contract tests: one suite any adapter implementation (mock now, live later) must pass."""
import pytest

from app.adapters import mock
from app.adapters.base import ProviderPending

KYC = [mock.MockKyc]
LENDER = [mock.MockLender]


@pytest.mark.parametrize("cls", KYC)
def test_kyc_contract(cls):
    a = cls()
    ok = a.verify(pan="ABCDE1234F", legal_name="Asha Rao", method="pan_ckyc", idempotency_key="k1")
    bad = a.verify(pan="ABCDE1234X", legal_name="Asha Rao", method="pan_ckyc", idempotency_key="k2")
    assert ok["status"] == "verified" and bad["status"] == "name_mismatch"
    assert a.verify(pan="ABCDE1234F", legal_name="Asha Rao", method="pan_ckyc", idempotency_key="k1") == ok


@pytest.mark.parametrize("cls", LENDER)
def test_lender_contract(cls):
    a = cls()
    assert a.decide(application={"amount": 100000}, round=1, idempotency_key="x")["decision"] == "approved"
    assert a.decide(application={"amount": 200000}, round=1, idempotency_key="x")["decision"] == "more_info"
    assert a.decide(application={"amount": 200000}, round=2, idempotency_key="x")["decision"] == "approved"
    assert a.decide(application={"amount": 300000}, round=1, idempotency_key="x")["decision"] == "declined"
    offers = a.offers(application={"amount": 100000, "tenure": 24})
    assert offers and all(o["apr"] >= o["rate"] for o in offers)


def test_mandate_returns_pending_not_error():
    r = mock.MockMandate().register(application_id="a", ifsc="ABCD0123456", idempotency_key="k")
    assert isinstance(r, ProviderPending)


@pytest.mark.parametrize("name,outcome", [("blurry.png", "rejected"), ("x_mismatch.pdf", "needs_attention"),
                                          ("expired_id.pdf", "rejected"), ("ok.pdf", "verified")])
def test_parser_scripted_outcomes(name, outcome):
    r = mock.MockDocumentParser().parse(kind="salary_slip", filename=name, mime="application/pdf", data=b"", context={})
    assert r.outcome == outcome


def test_live_adapters_fail_clearly():
    from app.adapters import live
    from app.adapters.base import ProviderNotConfigured

    with pytest.raises(ProviderNotConfigured):
        live.LiveKyc().verify(pan="x")
