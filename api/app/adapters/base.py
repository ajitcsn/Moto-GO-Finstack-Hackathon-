"""Adapter interfaces. Each has a Mock* and a live implementation chosen by ADAPTER_<NAME>=mock|live.

Rules for every adapter: an idempotency key on each call, timeouts surface as ProviderPending
(never an exception), webhooks are verified before processing, and request/response hashes are
written to `events` by the caller (see services.finance.provider_call).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class ProviderPending:
    ref: str
    message: str = "The provider is still working on this."


class ProviderNotConfigured(Exception):
    pass


class OtpAdapter(Protocol):
    def generate(self, identifier: str) -> str: ...
    def deliver(self, identifier: str, code: str) -> None: ...


class ValuationAdapter(Protocol):
    def estimate(self, *, price_low: int, price_high: int, year: int, odometer: int | None, condition: str | None,
                 owners: int | None, accident: bool | None, modified: bool | None, city: str | None) -> dict: ...


class KycAdapter(Protocol):
    def verify(self, *, pan: str, legal_name: str, method: str, idempotency_key: str) -> dict | ProviderPending: ...


class BureauAdapter(Protocol):
    def pull(self, *, pan: str, idempotency_key: str) -> dict | ProviderPending: ...


class AccountAggregatorAdapter(Protocol):
    def initiate(self, *, application_id: str, return_url: str, idempotency_key: str) -> dict: ...
    def fetch(self, *, consent_handle: str) -> dict: ...


class DocumentParser(Protocol):
    def parse(self, *, kind: str, filename: str, mime: str, data: bytes, context: dict) -> "ParseResult": ...


@dataclass
class ParseResult:
    outcome: str  # verified | needs_attention | rejected
    reason: str | None = None
    extracted: dict[str, Any] = field(default_factory=dict)
    alternatives: list[str] = field(default_factory=list)


class LenderAdapter(Protocol):
    def decide(self, *, application: dict, round: int, idempotency_key: str) -> dict | ProviderPending: ...
    def offers(self, *, application: dict) -> list[dict]: ...


class MandateAdapter(Protocol):
    def register(self, *, application_id: str, ifsc: str, idempotency_key: str) -> dict | ProviderPending: ...


class EsignAdapter(Protocol):
    def initiate(self, *, application_id: str, return_url: str, idempotency_key: str) -> dict: ...
    def complete(self, *, application_id: str, ref: str) -> dict: ...


class StorageAdapter(Protocol):
    def presign_put(self, *, key: str, mime: str, size: int) -> dict: ...
    def exists(self, key: str) -> bool: ...
    def read(self, key: str) -> bytes: ...
    def write(self, key: str, data: bytes) -> None: ...
    def delete(self, key: str) -> None: ...
