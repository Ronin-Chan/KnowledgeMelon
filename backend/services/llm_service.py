from importlib import import_module
import json
from typing import AsyncIterable, Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import SecretStr

from services.rag_service import rag_service
from services.memory_service import memory_service
from services.tools_service import tools_service

litellm = import_module("litellm")
acompletion = getattr(litellm, "acompletion")


def _to_text(value: Any) -> str:
    # LiteLLM / OpenAI 兼容层返回的 content 可能是 string，也可能是分片结构。
    # 这里统一把各种可能形态压平成纯文本，方便后面拼 prompt 和处理工具调用结果。
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
                continue
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return ""


class LLMService:
    WEB_SEARCH_TOOL_NAME = "web_search"

    def _normalize_response_length(self, response_length: Optional[str]) -> str:
        value = (response_length or "balanced").strip().lower()
        if value in {"concise", "balanced", "detailed"}:
            return value
        return "balanced"

    def _response_controls(self, response_length: Optional[str]) -> Dict[str, Any]:
        level = self._normalize_response_length(response_length)
        controls = {
            "concise": {
                "max_tokens": 500,
                "temperature": 0.35,
                "style_prompt": (
                    "Keep the answer concise and focused. "
                    "Use short paragraphs or bullets, but avoid fragmented one-line replies. "
                    "Prefer complete sentences."
                ),
            },
            "balanced": {
                "max_tokens": 900,
                "temperature": 0.45,
                "style_prompt": (
                    "Keep the answer moderately detailed. "
                    "Use normal paragraphs, and only use bullets when they genuinely improve clarity. "
                    "Avoid overly short sentence fragments."
                ),
            },
            "detailed": {
                "max_tokens": 1500,
                "temperature": 0.55,
                "style_prompt": (
                    "Give a detailed answer with clear structure, examples, and explanations when helpful. "
                    "Still avoid choppy sentence fragments."
                ),
            },
        }
        return controls[level]

    def infer_provider(self, model: str, base_url: Optional[str] = None) -> str:
        """根据模型名 / base_url 推断实际提供商。"""
        return self._infer_provider(model, base_url)

    def _infer_provider(self, model: str, base_url: Optional[str] = None) -> str:
        # 这个项目允许用户自由切换模型和代理地址，所以不能只靠 model 字符串。
        # 这里通过模型名和 base_url 一起推断提供商，后续知识库、记忆、embedding 都会复用这个判断。
        model_name = (model or "").lower()
        url = (base_url or "").lower()

        if "glm" in model_name or "zhipu" in model_name or "bigmodel.cn" in url:
            return "zhipu"
        if "moonshot" in model_name or "kimi" in model_name or "moonshot" in url:
            return "moonshot"
        if "qwen" in model_name or "dashscope" in url or "aliyun" in url:
            return "alibaba"
        return "openai"

    def _normalize_history(
        self, history: Optional[List[Any]]
    ) -> List[Dict[str, str]]:
        # 前端传来的历史消息可能是 dict，也可能是 ORM / Pydantic 结构。
        # 这里统一成标准聊天消息格式，确保后面的模型调用只关心 role/content。
        normalized: List[Dict[str, str]] = []
        if not history:
            return normalized

        for message in history:
            if isinstance(message, dict):
                role = message.get("role")
                content = message.get("content")
            else:
                role = getattr(message, "role", None)
                content = getattr(message, "content", None)

            if not role or content is None:
                continue

            normalized.append({"role": str(role), "content": str(content)})

        return normalized

    def _extract_chunk_text(self, chunk: Any) -> str:
        # 模型流式输出的 chunk 格式并不稳定：
        # - 有时是字符串
        # - 有时是 OpenAI 风格对象
        # - 有时是 dict
        # 这里做统一提取，保证前端始终收到可直接渲染的纯文本。
        if chunk is None:
            return ""
        if isinstance(chunk, str):
            return chunk
        if isinstance(chunk, dict):
            choices = chunk.get("choices") or []
            if not choices:
                return ""
            choice = choices[0]
            if isinstance(choice, dict):
                delta = choice.get("delta") or {}
                text = delta.get("content") if isinstance(delta, dict) else None
                if isinstance(text, str):
                    return text
                message = choice.get("message") or {}
                if isinstance(message, dict):
                    return _to_text(message.get("content"))
            return ""

        choices = getattr(chunk, "choices", None)
        if choices:
            choice = choices[0]
            delta = getattr(choice, "delta", None)
            if delta is not None:
                text = getattr(delta, "content", None)
                if isinstance(text, str):
                    return text
            message = getattr(choice, "message", None)
            if message is not None:
                return _to_text(getattr(message, "content", None))

        text = getattr(chunk, "text", None)
        if isinstance(text, str):
            return text
        return ""

    def _get_web_search_tool_defs(self) -> List[Dict[str, Any]]:
        # 只暴露 web_search 这一类工具，避免模型在当前版本拿到过多可执行能力。
        # 这样既能联网搜索，又能把风险范围控制住。
        web_search_tool = tools_service.get_tool(self.WEB_SEARCH_TOOL_NAME)
        if not web_search_tool:
            return []
        return [web_search_tool.to_dict()]

    def _format_attachments_context(
        self,
        attachments: Optional[List[Any]],
        max_chars_per_attachment: int = 8000,
        max_total_chars: int = 16000,
    ) -> str:
        # 当前会话附件不是知识库的一部分，它只在这一轮对话里临时生效。
        # 所以这里会把附件内容压成一段“临时上下文”，然后和 system prompt 拼到一起。
        if not attachments:
            return ""

        sections: List[str] = []
        total_chars = 0

        for attachment in attachments:
            if isinstance(attachment, dict):
                name = str(attachment.get("name") or "attachment")
                file_type = str(attachment.get("file_type") or "").lower()
                content = str(attachment.get("content") or "")
            else:
                name = str(getattr(attachment, "name", "attachment"))
                file_type = str(getattr(attachment, "file_type", "")).lower()
                content = str(getattr(attachment, "content", ""))

            cleaned_content = content.strip()
            if not cleaned_content:
                continue

            # 单个附件会被截断，避免一份超长文件把上下文窗口吃满。
            truncated_content = cleaned_content[:max_chars_per_attachment]
            section = (
                f"- File: {name}\n"
                f"  Type: {file_type or 'unknown'}\n"
                f"  Content:\n{truncated_content}"
            )

            if total_chars + len(section) > max_total_chars:
                break

            sections.append(section)
            total_chars += len(section)

        if not sections:
            return ""

        return "Current session attachments (temporary context):\n" + "\n\n".join(sections)

    async def _build_messages(
        self,
        message: str,
        history: Optional[List[Any]],
        api_key: str,
        model: str,
        base_url: Optional[str],
        session: Optional[AsyncSession],
        user_id: Optional[str],
        use_rag: bool,
        use_memory: bool,
        response_length: Optional[str],
        attachments: Optional[List[Any]] = None,
    ) -> List[Dict[str, Any]]:
        # 这里是整个 AI 请求链路最关键的地方：
        # 把知识库、记忆、附件、历史消息统一拼成最终发给模型的 messages。
        provider = self._infer_provider(model, base_url)

        prompt_sections: List[str] = [
            # system prompt 作为最底层规则，先定义助手的基本行为。
            "You are a helpful assistant. Answer clearly and accurately."
        ]
        prompt_sections.append(self._response_controls(response_length)["style_prompt"])

        if use_rag and session and api_key and user_id:
            # RAG：从知识库里取和当前问题最相关的文档片段。
            # 这里只是把检索结果拼进 prompt，不直接让模型“自己去查数据库”。
            rag_context = await rag_service.get_context_for_query(
                query=message,
                api_key=api_key,
                session=session,
                user_id=user_id,
                provider=provider,
                base_url=base_url,
            )
            if rag_context.strip():
                prompt_sections.append(
                    "Relevant document context:\n" + rag_context.strip()
                )

        if use_memory and session and api_key and user_id:
            # Memory：从长期记忆里取和当前问题相关的用户信息。
            # 它更像用户画像，而不是文档知识。
            memory_context = await memory_service.get_memory_context(
                query=message,
                api_key=api_key,
                session=session,
                user_id=user_id,
                provider=provider,
                base_url=base_url,
            )
            if memory_context.strip():
                prompt_sections.append(memory_context.strip())

        attachment_context = self._format_attachments_context(attachments)
        if attachment_context:
            # 当前会话附件只在这一轮临时可见，不写入知识库。
            prompt_sections.append(attachment_context)

        # 最终消息顺序：
        # 1. system：基础规则 + 检索上下文
        # 2. history：过去对话
        # 3. user：当前问题
        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": "\n\n".join(prompt_sections)}
        ]
        messages.extend(self._normalize_history(history))
        messages.append({"role": "user", "content": message})
        return messages

    async def stream_chat(
        self,
        message: str,
        api_key: str,
        model: str,
        use_rag: bool = False,
        use_memory: bool = False,
        use_tools: bool = False,
        attachments: Optional[List[Any]] = None,
        base_url: Optional[str] = None,
        session: Optional[AsyncSession] = None,
        history: Optional[List[Any]] = None,
        user_id: Optional[str] = None,
        response_length: Optional[str] = None,
    ) -> AsyncIterable[str]:
        # 先把最终上下文拼好，再交给模型。
        # 这样上层只需要控制“开没开 RAG / Memory / Tools”，不用关心 prompt 细节。
        messages = await self._build_messages(
            message=message,
            history=history,
            api_key=api_key,
            model=model,
            base_url=base_url,
            session=session,
            user_id=user_id,
            use_rag=use_rag,
            use_memory=use_memory,
            response_length=response_length,
            attachments=attachments,
        )

        response_controls = self._response_controls(response_length)

        common_kwargs: Dict[str, Any] = {
            "model": model,
            "api_key": api_key,
            "base_url": base_url,
            "max_tokens": response_controls["max_tokens"],
            "temperature": response_controls["temperature"],
        }

        if use_tools:
            # 工具模式是“两段式”：
            # 1) 先让模型决定是否要调用工具
            # 2) 执行工具后，把结果再喂回模型生成最终回复
            tool_defs = self._get_web_search_tool_defs()
            if not tool_defs:
                # 没有可用工具时，退回普通流式聊天。
                stream = await acompletion(
                    **common_kwargs,
                    messages=messages,
                    stream=True,
                )
                async for chunk in stream:
                    text = self._extract_chunk_text(chunk)
                    if text:
                        yield text
                return

            initial_response = await acompletion(
                **common_kwargs,
                messages=messages,
                tools=tool_defs,
                tool_choice="auto",
                stream=False,
            )

            # 先看模型是否真的发起了 tool call。
            choice = initial_response.choices[0] if initial_response.choices else None
            assistant_message = getattr(choice, "message", None) if choice else None
            tool_calls = getattr(assistant_message, "tool_calls", None) if assistant_message else None

            if not tool_calls:
                # 如果模型只直接回答了内容，就直接返回，不强制走工具链。
                content = _to_text(getattr(assistant_message, "content", None)) if assistant_message else ""
                if content:
                    yield content
                return

            # 把 assistant 的 tool_calls 结果补回 messages，
            # 这一步是为了符合 function calling 的对话格式。
            messages.append(
                {
                    "role": "assistant",
                    "content": _to_text(getattr(assistant_message, "content", None)) if assistant_message else "",
                    "tool_calls": [
                        {
                            "id": call.id,
                            "type": getattr(call, "type", "function"),
                            "function": {
                                "name": call.function.name,
                                "arguments": call.function.arguments,
                            },
                        }
                        for call in tool_calls
                    ],
                }
            )

            for call in tool_calls:
                tool_name = call.function.name
                if tool_name != self.WEB_SEARCH_TOOL_NAME:
                    # 当前版本只允许 web_search，其他工具一律拒绝。
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call.id,
                            "name": tool_name,
                            "content": f"Error: tool '{tool_name}' is not allowed.",
                        }
                    )
                    continue

                try:
                    # 工具参数是 JSON 字符串，先解析再执行。
                    arguments = json.loads(call.function.arguments or "{}")
                except Exception:
                    arguments = {}

                # 真正执行外部能力，例如联网搜索。
                tool_result = await tools_service.execute_tool(
                    tool_name,
                    arguments,
                )
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.id,
                        "name": tool_name,
                        "content": tool_result,
                    }
                )

            stream = await acompletion(
                **common_kwargs,
                messages=messages,
                tools=tool_defs,
                stream=True,
            )
        else:
            stream = await acompletion(
                **common_kwargs,
                messages=messages,
                stream=True,
            )

        async for chunk in stream:
            text = self._extract_chunk_text(chunk)
            if text:
                yield text

    async def generate_conversation_title(
        self,
        api_key: str,
        model: str,
        user_message: str,
        assistant_message: str,
        base_url: Optional[str] = None,
    ) -> str:
        # 会话标题不是单独存的人工字段，而是根据第一轮问答自动生成。
        # 这样用户打开左侧历史时能快速知道这条对话在讲什么。
        prompt = (
            "Generate a concise chat title from the user question and assistant answer. "
            "Use the same language as the conversation. "
            "Return only the title, with no quotes, punctuation, or markdown."
        )
        messages = [
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": (
                    f"User question:\n{user_message}\n\n"
                    f"Assistant answer:\n{assistant_message}"
                ),
            },
        ]

        try:
            # 用一个更轻量、更便宜的调用来生成标题，避免为了标题再走一遍长上下文聊天。
            response = await acompletion(
                model=model,
                api_key=api_key,
                base_url=base_url,
                messages=messages,
                stream=False,
                temperature=0.2,
            )
            choice = response.choices[0] if getattr(response, "choices", None) else None
            message = getattr(choice, "message", None) if choice else None
            title = _to_text(getattr(message, "content", None)).strip() if message else ""
            if title:
                return title[:80]
        except Exception:
            pass

        # 如果模型标题生成失败，就退回到用户首句问题的截断版本。
        fallback = user_message.strip().replace("\n", " ")
        if len(fallback) > 60:
            fallback = fallback[:57].rstrip() + "..."
        return fallback or "New conversation"


llm_service = LLMService()
