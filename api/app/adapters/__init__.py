from __future__ import annotations

from functools import lru_cache

from ..config import settings
from . import live, mock

_MOCK = {
    "otp": mock.MockOtp, "valuation": mock.MockValuation, "kyc": mock.MockKyc, "bureau": mock.MockBureau,
    "aa": mock.MockAA, "docparser": mock.MockDocumentParser, "lender": mock.MockLender,
    "mandate": mock.MockMandate, "esign": mock.MockEsign,
}
_LIVE = {
    "otp": live.LiveOtp, "valuation": live.LiveValuation, "kyc": live.LiveKyc, "bureau": live.LiveBureau,
    "aa": live.LiveAA, "docparser": live.LiveDocumentParser, "lender": live.LiveLender,
    "mandate": live.LiveMandate, "esign": live.LiveEsign,
}


@lru_cache(maxsize=None)
def get(name: str):
    """Return the adapter instance for `name`, selected by ADAPTER_<NAME>=mock|live."""
    if name == "storage":
        return mock.LocalStorage() if settings.adapter_storage == "local" else live.S3Storage()
    mode = getattr(settings, f"adapter_{name}")
    return (_MOCK if mode == "mock" else _LIVE)[name]()


def is_mock(name: str) -> bool:
    return getattr(settings, f"adapter_{name}") == "mock"
