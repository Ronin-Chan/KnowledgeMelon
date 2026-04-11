from datetime import datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.entities import Memory
from services.embedding_service import embedding_service


class MemoryService:
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
        embedding = await embedding_service.get_single_embedding(content, api_key, provider, base_url)
        memory = Memory(
            user_id=user_id,
            content=content,
            category=category,
            importance=importance,
            source=source,
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

        llm = ChatOpenAI(api_key=api_key, model="gpt-4.1-mini", temperature=0.3)
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
        query_embedding = await embedding_service.get_single_embedding(query, api_key, provider, base_url)
        result = await session.execute(
            select(Memory)
            .where(Memory.user_id == user_id)
            .order_by(Memory.embedding.cosine_distance(query_embedding))
            .limit(limit)
        )
        return result.scalars().all()

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
        query = select(Memory).where(Memory.user_id == user_id)
        if category:
            query = query.where(Memory.category == category)
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
