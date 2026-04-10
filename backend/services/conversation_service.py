"""
用于持久化、摘要生成和按 token 裁剪上下文的对话服务。

这个文件是项目里最重要的 AI 相关服务之一，因为它决定了多少历史会进入下一次模型调用。
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime
import uuid
import tiktoken

from models.database import Conversation, Message
from services.llm_service import llm_service

# 上下文预算配置。
# 目标是在给模型回复保留足够空间的同时，尽量保留最重要的对话历史。
MAX_CONTEXT_TOKENS = 120000
MAX_MESSAGES_BEFORE_SUMMARY = 20
SUMMARY_TRIGGER_THRESHOLD = 100000


def count_tokens(text: str, model: str = "gpt-4.1-mini") -> int:
    """估算一段文本的 token 数。"""
    try:
        # 优先使用真实 tokenizer，这样摘要触发条件更接近实际。
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except Exception:
        # 如果模型 tokenizer 不可用，就使用回退估算。
        return len(text) // 4


def count_messages_tokens(messages: List[Dict[str, str]], model: str = "gpt-4.1-mini") -> int:
    """估算一组聊天消息的 token 数。"""
    total = 0
    for msg in messages:
        total += count_tokens(msg.get("content", ""), model)
        # 聊天消息的结构本身也会消耗 token，所以加一点额外开销。
        total += 4
    return total


class ConversationService:
    """对话持久化与历史管理。"""

    async def create_conversation(
        self,
        session: AsyncSession,
        title: Optional[str] = None,
        model: str = "gpt-4.1-mini",
    ) -> Conversation:
        """创建一条新的激活状态对话记录。"""
        conversation = Conversation(
            id=uuid.uuid4(),
            title=title or "新对话",
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
    ) -> Optional[Conversation]:
        """按 id 获取一条激活中的对话。"""
        result = await session.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.is_active == 1,
            )
        )
        return result.scalar_one_or_none()

    async def get_conversation_messages(
        self,
        session: AsyncSession,
        conversation_id: str,
        limit: int = 1000,
    ) -> List[Message]:
        """获取某个对话完整且有序的消息列表。"""
        result = await session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
            .limit(limit)
        )
        return result.scalars().all()

    async def get_recent_messages(
        self,
        session: AsyncSession,
        conversation_id: str,
        limit: int = 10,
    ) -> List[Message]:
        """获取最近消息，供记忆提取或快速查看使用。"""
        result = await session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        messages = result.scalars().all()
        # 再反转回时间正序。
        return list(reversed(messages))

    async def add_message(
        self,
        session: AsyncSession,
        conversation_id: str,
        role: str,
        content: str,
        model: str = "gpt-4.1-mini",
    ) -> Message:
        """保存一条聊天消息并更新对话统计信息。"""
        tokens = count_tokens(content, model)

        message = Message(
            id=uuid.uuid4(),
            conversation_id=uuid.UUID(conversation_id)
            if isinstance(conversation_id, str)
            else conversation_id,
            role=role,
            content=content,
            tokens=tokens,
            is_summarized=0,
            created_at=datetime.utcnow(),
        )
        session.add(message)

        # 在对话记录上维护滚动统计，这样后续触发摘要时就不用重新计算全部 token。
        conversation = await self.get_conversation(session, str(conversation_id))
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
        api_key: str,
    ) -> str:
        """对长对话的前半段生成摘要。"""
        messages = await self.get_conversation_messages(session, conversation_id)
        if len(messages) < 10:
            # 短对话不需要压缩。
            return ""

        # 大致摘要前半段，并保留后半段作为原始上下文。
        messages_to_summarize = messages[: len(messages) // 2]

        # 将消息整理成紧凑的纯文本转录，供摘要模型使用。
        conversation_text = "\n".join(
            [f"{msg.role}: {msg.content[:500]}" for msg in messages_to_summarize]
        )

        summary_prompt = f"""请对以下对话进行摘要，保留关键信息和上下文：

{conversation_text}

请用简洁的语言总结上述对话的核心内容，包括：
1. 讨论的主要话题
2. 已达成的共识或结论
3. 待解决的问题

摘要："""

        # 用轻量模型做摘要，降低成本。
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

        conversation = await self.get_conversation(session, conversation_id)
        if conversation:
            conversation.summary = summary
            conversation.summary_tokens = count_tokens(summary)

            # 把已摘要的消息标记出来，方便后续裁剪上下文时跳过。
            for msg in messages_to_summarize:
                msg.is_summarized = 1

            await session.commit()

        return summary

    async def get_optimized_context(
        self,
        session: AsyncSession,
        conversation_id: str,
        current_model: str = "gpt-4.1-mini",
        max_tokens: int = MAX_CONTEXT_TOKENS,
    ) -> List[Dict[str, str]]:
        """
        构建一个感知 token 的上下文窗口。

        优先级：
        1. 现有摘要
        2. 最近的未摘要消息
        3. 到达 token 预算后停止
        """
        conversation = await self.get_conversation(session, conversation_id)
        if not conversation:
            return []

        messages = await self.get_conversation_messages(session, conversation_id)
        if not messages:
            return []

        result = []
        total_tokens = 0

        # 如果存在摘要，就作为 system 消息放到最前面。
        if conversation.summary:
            summary_msg = {
                "role": "system",
                "content": f"[对话历史摘要] {conversation.summary}",
            }
            summary_tokens = count_tokens(summary_msg["content"], current_model)
            if total_tokens + summary_tokens < max_tokens:
                result.append(summary_msg)
                total_tokens += summary_tokens

        # 从最新到最旧添加消息，直到耗尽预算。
        recent_messages = []
        for msg in reversed(messages):
            if msg.is_summarized:
                continue

            msg_dict = {"role": msg.role, "content": msg.content}
            msg_tokens = count_tokens(msg.content, current_model) + 4

            if total_tokens + msg_tokens > max_tokens:
                break

            recent_messages.insert(0, msg_dict)
            total_tokens += msg_tokens

        result.extend(recent_messages)
        return result

    async def should_generate_summary(
        self,
        session: AsyncSession,
        conversation_id: str,
    ) -> bool:
        """判断对话是否已经足够长，需要生成摘要。"""
        conversation = await self.get_conversation(session, conversation_id)
        if not conversation:
            return False

        if conversation.message_count >= MAX_MESSAGES_BEFORE_SUMMARY:
            if not conversation.summary:
                return True

        if conversation.total_tokens >= SUMMARY_TRIGGER_THRESHOLD:
            return True

        return False

    async def list_conversations(
        self,
        session: AsyncSession,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Conversation]:
        """列出用于侧边栏展示的激活对话。"""
        result = await session.execute(
            select(Conversation)
            .where(Conversation.is_active == 1)
            .order_by(desc(Conversation.updated_at))
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def delete_conversation(
        self,
        session: AsyncSession,
        conversation_id: str,
    ) -> bool:
        """软删除一条对话。"""
        conversation = await self.get_conversation(session, conversation_id)
        if conversation:
            conversation.is_active = 0
            await session.commit()
            return True
        return False

    async def update_conversation_title(
        self,
        session: AsyncSession,
        conversation_id: str,
        title: str,
    ) -> bool:
        """更新对话标题。"""
        conversation = await self.get_conversation(session, conversation_id)
        if conversation:
            conversation.title = title
            await session.commit()
            return True
        return False

    async def generate_conversation_title(
        self,
        session: AsyncSession,
        conversation_id: str,
        api_key: str,
        model: str,
        base_url: str = None,
    ) -> Optional[str]:
        """根据首轮用户/助手消息生成并保存标题。"""
        conversation = await self.get_conversation(session, conversation_id)
        if not conversation:
            return None

        # 只对仍然使用默认占位标题的对话自动生成标题。
        default_titles = {"新对话", "New conversation", "New chat", "", None}
        if conversation.title not in default_titles:
            return conversation.title

        # 标题只需要首轮问答，不需要整段对话。
        messages = await self.get_conversation_messages(session, conversation_id, limit=2)
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
