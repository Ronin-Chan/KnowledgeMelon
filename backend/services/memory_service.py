from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from models.database import Memory
from services.embedding_service import embedding_service

class MemoryService:
    async def create_memory(
        self,
        content: str,
        api_key: str,
        session: AsyncSession,
        category: str = "fact",
        importance: int = 5,
        source: str = "",
        provider: str = "openai",
        base_url: str = None
    ) -> Memory:
        """创建一条带 embedding 的新记忆。"""
        # 记忆和知识库一样，也需要 embedding 才能做语义检索。
        embedding = await embedding_service.get_single_embedding(
            content, api_key, provider, base_url
        )

        memory = Memory(
            content=content,
            category=category,
            importance=importance,
            source=source,
            embedding=embedding
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
        provider: str = "openai",
        base_url: str = None
    ) -> List[Memory]:
        """从对话中提取重要信息。"""
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage, SystemMessage
        from sqlalchemy import select
        import json

        # 自动提取是否开启、白名单/黑名单、最低重要性，都由记忆设置控制。
        from api.memories import get_memory_settings_from_db
        settings = await get_memory_settings_from_db(session)

        # 没开自动提取时，直接跳过，避免后台任务白白调用模型。
        if not settings.get("auto_extract", True):
            print("[Memory] Auto-extract is disabled, skipping extraction")
            return []

        # 这里使用一个更轻量的模型来做“信息抽取”，不是直接做最终回答。
        llm = ChatOpenAI(api_key=api_key, model="gpt-4.1-mini", temperature=0.3)

        # 目标是从自然语言对话里提取结构化 JSON，而不是自由发挥。
        system_prompt = """Extract important facts/preferences from conversation.
Return JSON array: [{"content": "...", "category": "preference|fact|goal", "importance": 1-10}]"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Conversation:\n{conversation_text}")
        ]

        try:
            response = await llm.ainvoke(messages)
            content = response.content.strip()
            if content.startswith("```json"):
                content = content[7:-3].strip()

            # 记忆提取器必须返回列表格式，否则就认为这次提取失败。
            memories_data = json.loads(content)
            if not isinstance(memories_data, list):
                return []

            created_memories = []
            min_importance = settings.get("min_importance", 5)
            whitelist = settings.get("whitelist_topics", [])
            blacklist = settings.get("blacklist_topics", [])

            for mem_data in memories_data:
                importance = mem_data.get("importance", 5)
                memory_content = mem_data.get("content", "")

                # 太低价值的内容不入库，避免记忆库被无意义信息污染。
                if importance < min_importance:
                    print(f"[Memory] Skipping low importance memory: {memory_content[:50]}...")
                    continue

                # 黑名单主题直接跳过。
                is_blacklisted = any(b.lower() in memory_content.lower() for b in blacklist if b)
                if is_blacklisted:
                    print(f"[Memory] Skipping blacklisted topic: {memory_content[:50]}...")
                    continue

                # 白名单存在时，只保留命中的内容。
                if whitelist and any(w for w in whitelist if w):
                    is_whitelisted = any(w.lower() in memory_content.lower() for w in whitelist if w)
                    if not is_whitelisted:
                        print(f"[Memory] Skipping non-whitelisted topic: {memory_content[:50]}...")
                        continue

                memory = await self.create_memory(
                    content=memory_content,
                    api_key=api_key,
                    session=session,
                    category=mem_data.get("category", "fact"),
                    importance=importance,
                    source="extracted from conversation",
                    provider=provider,
                    base_url=base_url
                )
                created_memories.append(memory)

            return created_memories
        except Exception as e:
            print(f"Error extracting memories: {e}")
            return []
    
    async def search_relevant_memories(
        self,
        query: str,
        api_key: str,
        session: AsyncSession,
        limit: int = 5,
        provider: str = "openai",
        base_url: str = None
    ) -> List[Memory]:
        """搜索相关记忆。"""
        # 先把查询也转成 embedding，再做向量相似度搜索。
        query_embedding = await embedding_service.get_single_embedding(query, api_key, provider, base_url)

        result = await session.execute(
            select(Memory)
            .order_by(Memory.embedding.cosine_distance(query_embedding))
            .limit(limit)
        )

        return result.scalars().all()

    async def get_memory_context(
        self,
        query: str,
        api_key: str,
        session: AsyncSession,
        limit: int = 5,
        provider: str = "openai",
        base_url: str = None
    ) -> str:
        """为 LLM prompt 获取记忆上下文。"""
        memories = await self.search_relevant_memories(query, api_key, session, limit, provider, base_url)
        if not memories:
            return ""

        # 把检索出来的记忆压成短文本，直接放进 prompt。
        context_parts = [f"- {m.content}" for m in memories]
        return "Relevant information:\n" + "\n".join(context_parts)
    
    async def list_memories(
        self,
        session: AsyncSession,
        category: Optional[str] = None,
        limit: int = 50
    ) -> List[Memory]:
        """列出所有记忆，可选按分类过滤。"""
        query = select(Memory)
        
        if category:
            query = query.where(Memory.category == category)
        
        query = query.order_by(Memory.importance.desc(), Memory.created_at.desc()).limit(limit)
        
        result = await session.execute(query)
        return result.scalars().all()
    
    async def update_memory(
        self,
        memory_id: str,
        session: AsyncSession,
        content: Optional[str] = None,
        importance: Optional[int] = None
    ) -> Optional[Memory]:
        """更新一条记忆。"""
        from uuid import UUID
        
        result = await session.execute(
            select(Memory).where(Memory.id == UUID(memory_id))
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
    
    async def delete_memory(self, memory_id: str, session: AsyncSession) -> bool:
        """删除一条记忆。"""
        from uuid import UUID
        
        result = await session.execute(
            select(Memory).where(Memory.id == UUID(memory_id))
        )
        memory = result.scalar_one_or_none()
        
        if not memory:
            return False
        
        await session.delete(memory)
        await session.commit()
        return True

memory_service = MemoryService()
