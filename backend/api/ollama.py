import aiohttp

from fastapi import APIRouter, Depends

from core.auth import get_current_user
from core.config import settings
from core.ollama import build_ollama_url, get_ollama_request_kwargs
from models.entities import User

router = APIRouter(prefix="/api/ollama", tags=["ollama"])


@router.get("/status")
async def ollama_status(current_user: User = Depends(get_current_user)):
    base_url = settings.ollama_base_url
    tags_url = build_ollama_url(base_url, "/api/tags")
    request_kwargs = get_ollama_request_kwargs()
    result = {
        "base_url": base_url,
        "reachable": False,
        "model": settings.ollama_embedding_model,
        "model_available": False,
        "message": "",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(tags_url, timeout=5, **request_kwargs) as response:
                if response.status != 200:
                    result["message"] = f"HTTP {response.status}"
                    return result

                data = await response.json()
                model_names = [item.get("name", "") for item in data.get("models", [])]
                result["reachable"] = True
                result["model_available"] = any(
                    settings.ollama_embedding_model in name for name in model_names
                )
                result["message"] = (
                    "ready"
                    if result["model_available"]
                    else "model_will_be_pulled_on_first_use"
                )
                return result
    except Exception as exc:
        result["message"] = str(exc)
        return result
