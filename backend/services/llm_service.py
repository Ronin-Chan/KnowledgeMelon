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
    def _infer_provider(self, model: str, base_url: Optional[str] = None) -> str:
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

    async def _build_messages(
        self,
        message: str,
        history: Optional[List[Any]],
        api_key: str,
        model: str,
        base_url: Optional[str],
        session: Optional[AsyncSession],
        use_rag: bool,
        use_memory: bool,
    ) -> List[Dict[str, Any]]:
        provider = self._infer_provider(model, base_url)

        prompt_sections: List[str] = [
            "You are a helpful assistant. Answer clearly and accurately."
        ]

        if use_rag and session and api_key:
            rag_context = await rag_service.get_context_for_query(
                query=message,
                api_key=api_key,
                session=session,
                provider=provider,
                base_url=base_url,
            )
            if rag_context.strip():
                prompt_sections.append(
                    "Relevant document context:\n" + rag_context.strip()
                )

        if use_memory and session and api_key:
            memory_context = await memory_service.get_memory_context(
                query=message,
                api_key=api_key,
                session=session,
                provider=provider,
                base_url=base_url,
            )
            if memory_context.strip():
                prompt_sections.append(memory_context.strip())

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
        base_url: Optional[str] = None,
        session: Optional[AsyncSession] = None,
        history: Optional[List[Any]] = None,
    ) -> AsyncIterable[str]:
        messages = await self._build_messages(
            message=message,
            history=history,
            api_key=api_key,
            model=model,
            base_url=base_url,
            session=session,
            use_rag=use_rag,
            use_memory=use_memory,
        )

        common_kwargs: Dict[str, Any] = {
            "model": model,
            "api_key": api_key,
            "base_url": base_url,
        }

        if use_tools:
            tool_defs = tools_service.get_tools()
            initial_response = await acompletion(
                **common_kwargs,
                messages=messages,
                tools=tool_defs,
                tool_choice="auto",
                stream=False,
            )

            choice = initial_response.choices[0] if initial_response.choices else None
            assistant_message = getattr(choice, "message", None) if choice else None
            tool_calls = getattr(assistant_message, "tool_calls", None) if assistant_message else None

            if not tool_calls:
                content = _to_text(getattr(assistant_message, "content", None)) if assistant_message else ""
                if content:
                    yield content
                return

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
                try:
                    arguments = json.loads(call.function.arguments or "{}")
                except Exception:
                    arguments = {}

                tool_result = await tools_service.execute_tool(
                    call.function.name,
                    arguments,
                )
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.id,
                        "name": call.function.name,
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


llm_service = LLMService()
