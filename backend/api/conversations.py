from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from core.database import get_session
from models.entities import Conversation, InteractionMetric, Message, User
from services.conversation_service import conversation_service

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


class ConversationCreate(BaseModel):
    title: Optional[str] = None
    model: str = "gpt-5.1-mini"


class ConversationUpdate(BaseModel):
    title: str


class MessageCreate(BaseModel):
    role: str
    content: str


def _safe_load_retrieved_sources(raw: str | None):
    if not raw:
        return []
    try:
        import json

        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except Exception:
        return []


class ConversationResponse(BaseModel):
    id: str
    title: str
    model: str
    created_at: str
    updated_at: str
    message_count: int
    total_tokens: int

    model_config = ConfigDict(from_attributes=True)


@router.post("", response_model=ConversationResponse)
async def create_conversation(
    request: ConversationCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    conversation = await conversation_service.create_conversation(
        session=session,
        user_id=current_user.id,
        title=request.title,
        model=request.model,
    )
    return ConversationResponse(
        id=str(conversation.id),
        title=conversation.title or "New conversation",
        model=conversation.model,
        created_at=conversation.created_at.isoformat(),
        updated_at=conversation.updated_at.isoformat(),
        message_count=conversation.message_count or 0,
        total_tokens=conversation.total_tokens or 0,
    )


@router.get("")
async def list_conversations(
    limit: int = 20,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    conversations = await conversation_service.list_conversations(session, current_user.id, limit, offset)
    return [
        {
            "id": str(c.id),
            "title": c.title or "New conversation",
            "model": c.model,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            "message_count": c.message_count or 0,
            "total_tokens": c.total_tokens or 0,
        }
        for c in conversations
    ]


@router.get("/search")
async def search_conversations(
    q: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not q or len(q) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")

    title_query = select(Conversation).where(
        Conversation.is_active == 1,
        Conversation.user_id == current_user.id,
        Conversation.title.ilike(f"%{q}%"),
    )
    message_query = (
        select(Conversation)
        .join(Message, Message.conversation_id == Conversation.id)
        .where(
            Conversation.is_active == 1,
            Conversation.user_id == current_user.id,
            Message.content.ilike(f"%{q}%"),
        )
        .distinct()
    )
    title_result = await session.execute(title_query)
    message_result = await session.execute(message_query)
    conversations = list(set(title_result.scalars().all()) | set(message_result.scalars().all()))
    conversations.sort(key=lambda c: c.updated_at or c.created_at, reverse=True)
    return [
        {
            "id": str(c.id),
            "title": c.title or "New conversation",
            "model": c.model,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            "message_count": c.message_count or 0,
            "total_tokens": c.total_tokens or 0,
        }
        for c in conversations
    ]


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    conversation = await conversation_service.get_conversation(session, conversation_id, current_user.id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = await conversation_service.get_conversation_messages(session, conversation_id, current_user.id)
    metric_result = await session.execute(
        select(InteractionMetric).where(
            InteractionMetric.conversation_id == conversation.id,
            InteractionMetric.user_id == current_user.id,
        )
    )
    metrics = metric_result.scalars().all()
    metric_map = {
        str(metric.message_id): metric
        for metric in metrics
        if metric.message_id is not None
    }
    fallback_metrics = [metric for metric in metrics if metric.message_id is None]
    fallback_index = 0

    def _match_metric(message_id: str, role: str):
        nonlocal fallback_index
        metric = metric_map.get(message_id)
        if metric:
            return metric
        if role == "assistant" and fallback_index < len(fallback_metrics):
            metric = fallback_metrics[fallback_index]
            fallback_index += 1
            return metric
        return None

    formatted_messages = []
    for message in messages:
        matched_metric = _match_metric(str(message.id), message.role)
        formatted_messages.append(
            {
                "id": str(message.id),
                "role": message.role,
                "content": message.content,
                "tokens": message.tokens or 0,
                "is_summarized": bool(message.is_summarized),
                "created_at": message.created_at.isoformat() if message.created_at else None,
                "retrieved_sources": _safe_load_retrieved_sources(
                    matched_metric.retrieved_sources_json if matched_metric else None
                ),
            }
        )

    return {
        "id": str(conversation.id),
        "title": conversation.title or "New conversation",
        "model": conversation.model,
        "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
        "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
        "message_count": conversation.message_count or 0,
        "total_tokens": conversation.total_tokens or 0,
        "summary": conversation.summary,
        "messages": formatted_messages,
    }


@router.put("/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    request: ConversationUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    success = await conversation_service.update_conversation_title(
        session=session,
        conversation_id=conversation_id,
        user_id=current_user.id,
        title=request.title,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    success = await conversation_service.delete_conversation(session, conversation_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}


@router.post("/{conversation_id}/messages")
async def add_message(
    conversation_id: str,
    request: MessageCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    conversation = await conversation_service.get_conversation(session, conversation_id, current_user.id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    message = await conversation_service.add_message(
        session=session,
        conversation_id=conversation_id,
        user_id=current_user.id,
        role=request.role,
        content=request.content,
    )
    return {
        "id": str(message.id),
        "role": message.role,
        "content": message.content,
        "tokens": message.tokens or 0,
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }
