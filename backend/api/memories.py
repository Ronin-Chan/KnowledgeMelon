from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from core.database import get_session
from models.api_schemas import MemoryCreate, MemoryUpdate
from models.entities import MemorySetting, User
from services.memory_service import memory_service

router = APIRouter(prefix="/api/memories", tags=["memories"])


class MemorySettingsRequest(BaseModel):
    auto_extract: bool = True
    whitelist_topics: List[str] = Field(default_factory=list)
    blacklist_topics: List[str] = Field(default_factory=list)
    min_importance: int = 5
    memory_ttl_days: int = 180
    memory_conflict_policy: str = "latest_wins"


async def get_memory_settings_from_db(session: AsyncSession, user_id) -> dict:
    result = await session.execute(select(MemorySetting).where(MemorySetting.user_id == user_id))
    settings = {item.key: item.value for item in result.scalars().all()}
    return {
        "auto_extract": settings.get("auto_extract", "true").lower() == "true",
        "whitelist_topics": settings.get("whitelist_topics", "").split(",") if settings.get("whitelist_topics") else [],
        "blacklist_topics": settings.get("blacklist_topics", "").split(",") if settings.get("blacklist_topics") else [],
        "min_importance": int(settings.get("min_importance", "5")),
        "memory_ttl_days": int(settings.get("memory_ttl_days", "180")),
        "memory_conflict_policy": settings.get("memory_conflict_policy", "latest_wins"),
    }


async def save_memory_settings_to_db(session: AsyncSession, user_id, settings: dict):
    settings_map = {
        "auto_extract": str(settings.get("auto_extract", True)).lower(),
        "whitelist_topics": ",".join(settings.get("whitelist_topics", [])),
        "blacklist_topics": ",".join(settings.get("blacklist_topics", [])),
        "min_importance": str(settings.get("min_importance", 5)),
        "memory_ttl_days": str(settings.get("memory_ttl_days", 180)),
        "memory_conflict_policy": settings.get("memory_conflict_policy", "latest_wins"),
    }
    for key, value in settings_map.items():
        result = await session.execute(
            select(MemorySetting).where(MemorySetting.user_id == user_id, MemorySetting.key == key)
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
            setting.updated_at = datetime.utcnow()
        else:
            session.add(MemorySetting(user_id=user_id, key=key, value=value))
    await session.commit()


@router.post("/")
async def create_memory(
    data: MemoryCreate,
    api_key: str = "",
    provider: str = "openai",
    base_url: str = "",
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not api_key:
        raise HTTPException(400, "API key required for embedding generation")
    memory = await memory_service.create_memory(
        content=data.content,
        api_key=api_key,
        session=session,
        user_id=current_user.id,
        category=data.category,
        importance=data.importance,
        source="manual",
        provider=provider,
        base_url=base_url if base_url else None,
    )
    return {
        "id": str(memory.id),
        "content": memory.content,
        "category": memory.category,
        "importance": memory.importance,
        "created_at": memory.created_at.isoformat(),
    }


@router.get("/")
async def list_memories(
    category: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    memories = await memory_service.list_memories(session, current_user.id, category)
    return [
        {
            "id": str(memory.id),
            "content": memory.content,
            "category": memory.category,
            "importance": memory.importance,
            "source": memory.source,
            "created_at": memory.created_at.isoformat(),
            "access_count": memory.access_count,
        }
        for memory in memories
    ]


@router.get("/search")
async def search_memories(
    query: str,
    api_key: str = "",
    provider: str = "openai",
    base_url: str = "",
    limit: int = 5,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not api_key:
        raise HTTPException(400, "API key required")
    memories = await memory_service.search_relevant_memories(
        query,
        api_key,
        session,
        current_user.id,
        limit,
        provider,
        base_url if base_url else None,
    )
    return [
        {"id": str(memory.id), "content": memory.content, "category": memory.category, "importance": memory.importance}
        for memory in memories
    ]


@router.put("/{memory_id}")
async def update_memory(
    memory_id: str,
    data: MemoryUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    memory = await memory_service.update_memory(
        memory_id,
        session,
        current_user.id,
        content=data.content,
        importance=data.importance,
    )
    if not memory:
        raise HTTPException(404, "Memory not found")
    return {"id": str(memory.id), "content": memory.content, "category": memory.category, "importance": memory.importance}


@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    success = await memory_service.delete_memory(memory_id, session, current_user.id)
    if not success:
        raise HTTPException(404, "Memory not found")
    return {"message": "Memory deleted"}


@router.post("/extract")
async def extract_memories(
    conversation_text: str,
    api_key: str = "",
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not api_key:
        raise HTTPException(400, "API key required")
    memories = await memory_service.extract_memories_from_conversation(
        conversation_text,
        api_key,
        session,
        current_user.id,
    )
    return [
        {"id": str(memory.id), "content": memory.content, "category": memory.category, "importance": memory.importance}
        for memory in memories
    ]


@router.get("/settings")
async def get_memory_settings(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await get_memory_settings_from_db(session, current_user.id)


@router.post("/settings")
async def update_memory_settings(
    request: MemorySettingsRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    settings = {
        "auto_extract": request.auto_extract,
        "whitelist_topics": request.whitelist_topics,
        "blacklist_topics": request.blacklist_topics,
        "min_importance": request.min_importance,
        "memory_ttl_days": request.memory_ttl_days,
        "memory_conflict_policy": request.memory_conflict_policy,
    }
    await save_memory_settings_to_db(session, current_user.id, settings)
    return {"success": True, "settings": settings}


@router.get("/settings/check-topic")
async def check_topic_allowed(
    topic: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    settings = await get_memory_settings_from_db(session, current_user.id)
    for blacklisted in settings["blacklist_topics"]:
        if blacklisted.lower() in topic.lower():
            return {"allowed": False, "reason": f"Topic matches blacklist: {blacklisted}"}
    if settings["whitelist_topics"]:
        for whitelisted in settings["whitelist_topics"]:
            if whitelisted.lower() in topic.lower():
                return {"allowed": True}
        return {"allowed": False, "reason": "Topic does not match any whitelist entry"}
    return {"allowed": True}
