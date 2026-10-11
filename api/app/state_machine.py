"""Application state machine. Every transition is written to `events` and pushed over SSE."""

STATES = [
    "draft", "consented", "identity_pending", "evidence_pending", "underwriting", "more_info",
    "offered", "accepted", "mandate_pending", "signed", "disbursal_pending", "disbursed",
]
SIDE_EXITS = {"declined", "cancelled", "expired", "error"}
TERMINAL = SIDE_EXITS | {"disbursed"}

TRANSITIONS: dict[str, set[str]] = {
    "draft": {"consented"},
    "consented": {"identity_pending"},
    "identity_pending": {"evidence_pending"},
    "evidence_pending": {"underwriting"},
    "underwriting": {"more_info", "offered"},
    "more_info": {"underwriting"},
    "offered": {"accepted"},
    "accepted": {"mandate_pending"},
    "mandate_pending": {"signed"},
    "signed": {"disbursal_pending"},
    "disbursal_pending": {"disbursed"},
}


class InvalidTransition(Exception):
    pass


def can_transition(src: str, dst: str) -> bool:
    if src in TERMINAL:
        return False
    return dst in SIDE_EXITS or dst in TRANSITIONS.get(src, set())


def check(src: str, dst: str) -> None:
    if not can_transition(src, dst):
        raise InvalidTransition(f"{src} -> {dst}")
