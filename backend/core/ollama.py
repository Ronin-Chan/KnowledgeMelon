from __future__ import annotations

from typing import Any, Optional

import aiohttp

from core.config import settings


def build_ollama_url(base_url: str, path: str) -> str:
    if base_url.endswith("/v1"):
        return base_url.replace("/v1", path)
    return f"{base_url.rstrip('/')}{path}"


def get_ollama_request_kwargs() -> dict[str, Any]:
    headers: dict[str, str] = {}
    auth: Optional[aiohttp.BasicAuth] = None

    if settings.ollama_api_key:
        headers["Authorization"] = f"Bearer {settings.ollama_api_key}"
    elif settings.ollama_username and settings.ollama_password:
        auth = aiohttp.BasicAuth(settings.ollama_username, settings.ollama_password)

    kwargs: dict[str, Any] = {}
    if headers:
        kwargs["headers"] = headers
    if auth is not None:
        kwargs["auth"] = auth
    return kwargs
