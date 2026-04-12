from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from core.database import get_session
from models.api_schemas import RetrievalPreviewRequest
from models.entities import User
from services.rag_service import rag_service

router = APIRouter(prefix="/api/rag", tags=["rag"])


@router.post("/preview")
async def preview_retrieval(
    request: RetrievalPreviewRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    sources = await rag_service.preview_similar(
        query=request.query,
        api_key=request.apiKey,
        session=session,
        user_id=current_user.id,
        limit=request.limit,
        provider=request.provider,
        base_url=request.baseUrl if request.baseUrl else None,
    )
    context = "\n\n".join(item["content"] for item in sources)
    return {
        "sources": sources,
        "context": context,
        "source_count": len(sources),
        "has_sources": bool(sources),
    }
