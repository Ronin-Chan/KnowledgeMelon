import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from cryptography.fernet import Fernet, InvalidToken

from core.config import settings


def _secret_bytes() -> bytes:
    secret = settings.app_secret or "development-secret-change-me"
    return secret.encode("utf-8")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        390000,
    )
    return base64.b64encode(salt + derived).decode("utf-8")


def verify_password(password: str, stored_hash: str) -> bool:
    decoded = base64.b64decode(stored_hash.encode("utf-8"))
    salt, expected = decoded[:16], decoded[16:]
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        390000,
    )
    return hmac.compare_digest(derived, expected)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(
    subject: str,
    expires_hours: Optional[int] = None,
) -> str:
    expires_delta = timedelta(hours=expires_hours or settings.access_token_expire_hours)
    payload = {
        "sub": subject,
        "exp": int((datetime.now(timezone.utc) + expires_delta).timestamp()),
    }
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = _b64url_encode(payload_json)
    signature = hmac.new(_secret_bytes(), payload_b64.encode("utf-8"), hashlib.sha256).digest()
    return f"{payload_b64}.{_b64url_encode(signature)}"


def verify_access_token(token: str) -> dict[str, Any]:
    try:
        payload_b64, signature_b64 = token.split(".", 1)
    except ValueError as exc:
        raise ValueError("Invalid token format") from exc

    expected = hmac.new(_secret_bytes(), payload_b64.encode("utf-8"), hashlib.sha256).digest()
    signature = _b64url_decode(signature_b64)
    if not hmac.compare_digest(expected, signature):
        raise ValueError("Invalid token signature")

    payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    if payload.get("exp", 0) < int(datetime.now(timezone.utc).timestamp()):
        raise ValueError("Token expired")
    return payload


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(_secret_bytes()).digest())
    return Fernet(key)


def encrypt_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt stored secret") from exc
