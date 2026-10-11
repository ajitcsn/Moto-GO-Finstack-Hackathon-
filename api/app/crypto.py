import base64
import hashlib

from cryptography.fernet import Fernet

from .config import settings


def _fernet() -> Fernet:
    key = settings.field_encryption_key or base64.urlsafe_b64encode(
        hashlib.sha256(("fe:" + settings.secret_key).encode()).digest()
    ).decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(s: str) -> str:
    return "enc:" + _fernet().encrypt(s.encode()).decode()


def decrypt(s: str) -> str:
    return _fernet().decrypt(s[4:].encode()).decode() if s.startswith("enc:") else s


def mask(value: str, keep: int = 4) -> str:
    v = decrypt(value) if isinstance(value, str) else str(value)
    return "•" * max(0, len(v) - keep) + v[-keep:]


def is_masked(v) -> bool:
    return isinstance(v, str) and "•" in v
