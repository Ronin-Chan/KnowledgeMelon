from datetime import datetime
import uuid
from typing import Dict, List, Optional

import tiktoken
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.entities import Conversation, Message
from services.llm_service import llm_service

MAX_CONTEXT_TOKENS = 120000
MAX_MESSAGES_BEFORE_SUMMARY = 20
SUMMARY_TRIGGER_THRESHOLD = 100000


def count_tokens(text: str, model: str = "gpt-4.1-mini") -> int:
    try:
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except Exception:
        return len(text) // 4


class ConversationService:
    async def create_conversation(
        self,
        session: AsyncSession,
        user_id,
        title: Optional[str] = None,
        model: str = "gpt-4.1-mini",
    ) -> Conversation:
        conversation = Conversation(
            id=uuid.uuid4(),
            user_id=user_id,
            title=title or "New conversation",
            model=model,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            message_count=0,
            total_tokens=0,
            is_active=1,
        )
        session.add(conversation)
        await session.commit()
        await session.refresh(conversation)
        return conversation

    async def get_conversation(
        self,
        session: AsyncSession,
        conversation_id: str,
        user_id,
    ) -> Optional[Conversation]:
        result = await session.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
                Conversation.is_active == 1,
            )
        )
        return result.scalar_one_or_none()

    async def get_conversation_messages(
        self,
        session: AsyncSession,
        conversation_id: str,
        user_id,
        limit: int = 1000,
    ) -> List[Message]:
        result = await session.execute(
            select(Message)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Message.conversation_id == conversation_id, Conversation.user_id == user_id)
            .order_by(Message.created_at.asc())
            .limit(limit)
        )
        return result.scalars().all()

    async def get_recent_messages(
        self,
        session: AsyncSession,
        conversation_id: str,
        user_id,
        limit: int = 10,
    ) -> List[Message]:
        result = await session.execute(
            select(Message)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Message.conversation_id == conversation_id, Conversation.user_id == user_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        return list(reversed(result.scalars().all()))

    async def add_message(
        self,
        session: AsyncSession,
        conversation_id: str,
        user_id,
        role: str,
        content: str,
        model: str = "gpt-4.1-mini",
    ) -> Message:
        tokens = count_tokens(content, model)
        message = Message(
            id=uuid.uuid4(),
            conversation_id=uuid.UUID(conversation_id) if isinstance(conversation_id, str) else conversation_id,
            role=role,
            content=content,
            tokens=tokens,
            is_summarized=0,
            created_at=datetime.utcnow(),
        )
        session.add(message)

        conversation = await self.get_conversation(session, str(conversation_id), user_id)
        if conversation:
            conversation.message_count += 1
            conversation.total_tokens += tokens
            conversation.updated_at = datetime.utcnow()

        await session.commit()
        await session.refresh(message)
        return message

    async def generate_summary(
        self,
        session: AsyncSession,
        conversation_id: str,
        user_id,
        api_key: str,
    ) -> str:
        messages = await self.get_conversation_messages(session, conversation_id, user_id)
        if len(messages) < 10:
            return ""

        messages_to_summarize = messages[: len(messages) // 2]
        conversation_text = "\n".join([f"{msg.role}: {msg.content[:500]}" for msg in messages_to_summarize])
        summary_prompt = (
            "Summarize this conversation and keep the key decisions, user intent, and unresolved questions.\n\n"
            f"{conversation_text}"
        )

        summary_chunks = []
        async for chunk in llm_service.stream_chat(
            message=summary_prompt,
            api_key=api_key,
            model="gpt-4.1-mini",
            use_rag=False,
            use_memory=False,
        ):
            summary_chunks.append(chunk)

        summary = "".join(summary_chunks)
        conversation = await self.get_conversation(session, conversation_id, user_id)
        if conversation:
            conversation.summary = summary
            conversation.summary_tokens = count_tokens(summary)
            for msg in messages_to_summarize:
                msg.is_summarized = 1
            await session.commit()
        return summary

    async def get_optimized_context(
        self,
        session: AsyncSession,
        conversation_id: str,
        user_id,
        current_model: str = "gpt-4.1-mini",
        max_tokens: int = MAX_CONTEXT_TOKENS,
    ) -> List[Dict[str, str]]:
        conversation = await self.get_conversation(session, conversation_id, user_id)
        if not conversation:
            return []

        messages = await self.get_conversation_messages(session, conversation_id, user_id)
        if not messages:
            return []

        result: List[Dict[str, str]] = []
        total_tokens = 0

        if conversation.summary:
            summary_message = {
                "role": "system",
                "content": f"[Conversation summary] {conversation.summary}",
            }
            summary_tokens = count_tokens(summary_message["content"], current_model)
            if total_tokens + summary_tokens < max_tokens:
                result.append(summary_message)
                total_tokens += summary_tokens

        recent_messages: List[Dict[str, str]] = []
        for msg in reversed(messages):
            if msg.is_summarized:
                continue

            msg_tokens = count_tokens(msg.content, current_model) + 4
            if total_tokens + msg_tokens > max_tokens:
                break

            recent_messages.insert(0, {"role": msg.role, "content": msg.content})
            total_tokens += msg_tokens

        result.extend(recent_messages)
        return result

    async def should_generate_summary(
        self,
        session: AsyncSession,
        conversation_id: str,
        user_id,
    ) -> bool:
        conversation = await self.get_conversation(session, conversation_id, user_id)
        if not conversation:
            return False
        if conversation.message_count >= MAX_MESSAGES_BEFORE_SUMMARY and not conversation.summary:
            return True
        return conversation.total_tokens >= SUMMARY_TRIGGER_THRESHOLD

    async def list_conversations(
        self,
        session: AsyncSession,
        user_id,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Conversation]:
        result = await session.execute(
            select(Conversation)
            .where(Conversation.is_active == 1, Conversation.user_id == user_id)
            .order_by(desc(Conversation.updated_at))
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def delete_conversation(
        self,
        session: AsyncSession,
        conversation_id: str,
        user_id,
    ) -> bool:
        conversation = await self.get_conversation(session, conversation_id, user_id)
        if not conversation:
            return False
        conversation.is_active = 0
        await session.commit()
        return True

    async def update_conversation_title(
        self,
        session: AsyncSession,
        conversation_id: str,
        user_id,
        title: str,
    ) -> bool:
        conversation = await self.get_conversation(session, conversation_id, user_id)
        if not conversation:
            return False
        conversation.title = title
        await session.commit()
        return True

    async def generate_conversation_title(
        self,
        session: AsyncSession,
        conversation_id: str,
        user_id,
        api_key: str,
        model: str,
        base_url: str = None,
    ) -> Optional[str]:
        conversation = await self.get_conversation(session, conversation_id, user_id)
        if not conversation:
            return None

        default_titles = {"New conversation", "New chat", "New Chat", "新对话", "", None}
        if conversation.title not in default_titles:
            return conversation.title

        messages = await self.get_conversation_messages(session, conversation_id, user_id, limit=2)
        user_message = next((m.content for m in messages if m.role == "user"), "").strip()
        assistant_message = next((m.content for m in messages if m.role == "assistant"), "").strip()
        if not user_message or not assistant_message:
            return conversation.title

        title = await llm_service.generate_conversation_title(
            api_key=api_key,
            model=model,
            user_message=user_message,
            assistant_message=assistant_message,
            base_url=base_url,
        )
        if title:
            conversation.title = title
            await session.commit()
            return title
        return conversation.title


conversation_service = ConversationService()

