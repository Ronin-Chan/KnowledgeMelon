from datetime import datetime, timedelta
import hashlib
import json
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.entities import Memory
from services.embedding_service import embedding_service


class MemoryService:
    def _normalize_key(self, content: str, category: str) -> str:
        normalized = " ".join((content or "").strip().lower().split())
        payload = f"{category.strip().lower()}::{normalized}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    async def _get_settings(self, session: AsyncSession, user_id) -> dict:
        from api.memories import get_memory_settings_from_db

        settings = await get_memory_settings_from_db(session, user_id)
        settings.setdefault("memory_ttl_days", 180)
        settings.setdefault("memory_conflict_policy", "latest_wins")
        return settings

    async def _cleanup_expired_memories(self, session: AsyncSession, user_id) -> None:
        now = datetime.utcnow()
        result = await session.execute(
            select(Memory).where(
                Memory.user_id == user_id,
                Memory.status == "active",
                Memory.expires_at.is_not(None),
                Memory.expires_at <= now,
            )
        )
        expired = result.scalars().all()
        for memory in expired:
            memory.status = "expired"
            memory.updated_at = now
        if expired:
            await session.commit()

    async def create_memory(
        self,
        content: str,
        api_key: str,
        session: AsyncSession,
        user_id,
        category: str = "fact",
        importance: int = 5,
        source: str = "",
        provider: str = "openai",
        base_url: str = None,
    ) -> Memory:
        settings = await self._get_settings(session, user_id)
        await self._cleanup_expired_memories(session, user_id)
        normalized_key = self._normalize_key(content, category)
        ttl_days = max(0, int(settings.get("memory_ttl_days", 180)))
        expires_at = datetime.utcnow() + timedelta(days=ttl_days) if ttl_days else None
        conflict_policy = settings.get("memory_conflict_policy", "latest_wins")

        existing_result = await session.execute(
            select(Memory).where(
                Memory.user_id == user_id,
                Memory.normalized_key == normalized_key,
                Memory.status == "active",
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            if conflict_policy == "importance_wins" and existing.importance >= importance:
                existing.last_accessed = datetime.utcnow()
                await session.commit()
                await session.refresh(existing)
                return existing

            existing.content = content
            existing.category = category
            existing.importance = max(existing.importance, importance) if conflict_policy == "importance_wins" else importance
            existing.source = source or existing.source
            existing.normalized_key = normalized_key
            existing.expires_at = expires_at
            existing.confidence = 1.0
            existing.metadata_json = json.dumps(
                {
                    "conflict_policy": conflict_policy,
                    "updated_from": "deduplicated_memory",
                },
                ensure_ascii=False,
            )
            existing.embedding = await embedding_service.get_single_embedding(content, api_key, provider, base_url)
            existing.updated_at = datetime.utcnow()
            await session.commit()
            await session.refresh(existing)
            return existing

        embedding = await embedding_service.get_single_embedding(content, api_key, provider, base_url)
        memory = Memory(
            user_id=user_id,
            content=content,
            category=category,
            importance=importance,
            source=source,
            normalized_key=normalized_key,
            status="active",
            expires_at=expires_at,
            confidence=1.0,
            metadata_json=json.dumps(
                {
                    "conflict_policy": conflict_policy,
                    "ttl_days": ttl_days,
                },
                ensure_ascii=False,
            ),
            embedding=embedding,
        )
        session.add(memory)
        await session.commit()
        await session.refresh(memory)
        return memory

    async def extract_memories_from_conversation(
        self,
        conversation_text: str,
        api_key: str,
        session: AsyncSession,
        user_id,
        provider: str = "openai",
        base_url: str = None,
    ) -> List[Memory]:
        import json

        from langchain_core.messages import HumanMessage, SystemMessage
        from langchain_openai import ChatOpenAI

        from api.memories import get_memory_settings_from_db

        settings = await get_memory_settings_from_db(session, user_id)
        if not settings.get("auto_extract", True):
            return []

        llm = ChatOpenAI(api_key=api_key, model="gpt-5.1-mini", temperature=0.3)
        messages = [
            SystemMessage(
                content=(
                    "Extract important long-term facts, preferences, and goals from the conversation. "
                    "Return a JSON array with content, category, and importance."
                )
            ),
            HumanMessage(content=f"Conversation:\n{conversation_text}"),
        ]

        try:
            response = await llm.ainvoke(messages)
            content = response.content.strip()
            if content.startswith("```json"):
                content = content[7:-3].strip()
            memories_data = json.loads(content)
            if not isinstance(memories_data, list):
                return []

            created_memories = []
            min_importance = settings.get("min_importance", 5)
            whitelist = settings.get("whitelist_topics", [])
            blacklist = settings.get("blacklist_topics", [])

            for mem_data in memories_data:
                memory_content = str(mem_data.get("content", "")).strip()
                importance = int(mem_data.get("importance", 5))
                if not memory_content or importance < min_importance:
                    continue
                if any(item and item.lower() in memory_content.lower() for item in blacklist):
                    continue
                if whitelist and not any(item and item.lower() in memory_content.lower() for item in whitelist):
                    continue

                memory = await self.create_memory(
                    content=memory_content,
                    api_key=api_key,
                    session=session,
                    user_id=user_id,
                    category=mem_data.get("category", "fact"),
                    importance=importance,
                    source="extracted from conversation",
                    provider=provider,
                    base_url=base_url,
                )
                created_memories.append(memory)

            return created_memories
        except Exception as exc:
            print(f"Error extracting memories: {exc}")
            return []

    async def search_relevant_memories(
        self,
        query: str,
        api_key: str,
        session: AsyncSession,
        user_id,
        limit: int = 5,
        provider: str = "openai",
        base_url: str = None,
    ) -> List[Memory]:
        await self._cleanup_expired_memories(session, user_id)
        query_embedding = await embedding_service.get_single_embedding(query, api_key, provider, base_url)
        result = await session.execute(
            select(Memory)
            .where(
                Memory.user_id == user_id,
                Memory.status == "active",
            )
            .where((Memory.expires_at.is_(None)) | (Memory.expires_at > datetime.utcnow()))
            .order_by(Memory.embedding.cosine_distance(query_embedding))
            .limit(limit)
        )
        memories = result.scalars().all()
        now = datetime.utcnow()
        for memory in memories:
            memory.access_count += 1
            memory.last_accessed = now
        if memories:
            await session.commit()
        return memories

    async def get_memory_context(
        self,
        query: str,
        api_key: str,
        session: AsyncSession,
        user_id,
        limit: int = 5,
        provider: str = "openai",
        base_url: str = None,
    ) -> str:
        memories = await self.search_relevant_memories(
            query,
            api_key,
            session,
            user_id,
            limit,
            provider,
            base_url,
        )
        if not memories:
            return ""
        return "Relevant information:\n" + "\n".join(f"- {memory.content}" for memory in memories)

    async def list_memories(
        self,
        session: AsyncSession,
        user_id,
        category: Optional[str] = None,
        limit: int = 50,
    ) -> List[Memory]:
        await self._cleanup_expired_memories(session, user_id)
        query = select(Memory).where(Memory.user_id == user_id, Memory.status == "active")
        if category:
            query = query.where(Memory.category == category)
        query = query.where((Memory.expires_at.is_(None)) | (Memory.expires_at > datetime.utcnow()))
        query = query.order_by(Memory.importance.desc(), Memory.created_at.desc()).limit(limit)
        result = await session.execute(query)
        return result.scalars().all()

    async def update_memory(
        self,
        memory_id: str,
        session: AsyncSession,
        user_id,
        content: Optional[str] = None,
        importance: Optional[int] = None,
    ) -> Optional[Memory]:
        from uuid import UUID

        result = await session.execute(
            select(Memory).where(Memory.id == UUID(memory_id), Memory.user_id == user_id)
        )
        memory = result.scalar_one_or_none()
        if not memory:
            return None

        if content is not None:
            memory.content = content
        if importance is not None:
            memory.importance = importance
        memory.normalized_key = self._normalize_key(memory.content, memory.category)
        memory.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(memory)
        return memory

    async def delete_memory(self, memory_id: str, session: AsyncSession, user_id) -> bool:
        from uuid import UUID

        result = await session.execute(
            select(Memory).where(Memory.id == UUID(memory_id), Memory.user_id == user_id)
        )
        memory = result.scalar_one_or_none()
        if not memory:
            return False
        await session.delete(memory)
        await session.commit()
        return True


memory_service = MemoryService()
