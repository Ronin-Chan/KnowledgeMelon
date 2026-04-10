from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import traceback
import os
import tempfile
import asyncio
import uuid

from models.schemas import ChatRequest, RAGChatRequest
from services.llm_service import llm_service
from services.conversation_service import conversation_service
from services.memory_service import memory_service
from services.document_service import document_service
from services.tools_service import tools_service
from core.database import get_session, async_session_maker

router = APIRouter(prefix="/api", tags=["chat"])


async def _extract_memories_background(
    conversation_id: str,
    api_key: str,
    provider: str = "openai",
    base_url: str = None,
):
    """从最近一段对话中提取长期记忆。"""
    try:
        async with async_session_maker() as session:
            # 只取最近一小段对话，让记忆提取器聚焦稳定事实。
            messages = await conversation_service.get_recent_messages(
                session=session,
                conversation_id=conversation_id,
                limit=10,
            )

            # 记忆提取至少需要一轮用户和助手消息。
            if len(messages) < 2:
                return

            # 把对话整理成纯文本，供提取模型使用。
            conversation_text = "\n".join(
                [
                    f"{'User' if m.role == 'user' else 'Assistant'}: {m.content}"
                    for m in messages
                ]
            )

            # 交给记忆服务，将这段聊天内容转成结构化记忆。
            extracted = await memory_service.extract_memories_from_conversation(
                conversation_text=conversation_text,
                api_key=api_key,
                session=session,
                provider=provider,
                base_url=base_url,
            )

            if extracted:
                print(
                    f"[Auto Memory] Extracted {len(extracted)} memories from conversation {conversation_id}"
                )

    except Exception as e:
        print(f"[Auto Memory Error] {type(e).__name__}: {e}")


async def _parse_temporary_attachment(file: UploadFile) -> dict:
    """仅将文件解析为临时会话上下文。

    这条路径不会写入知识库，只负责提取文本，方便当前对话立即引用文件内容。
    """
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    allowed_types = [".pdf", ".docx", ".txt", ".md"]
    if file_ext not in allowed_types:
        raise HTTPException(400, f"Unsupported file type. Allowed: {allowed_types}")

    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")

    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        # 复用文档解析器，让聊天附件和知识库上传使用同一套文件解析逻辑。
        parsed_text = await document_service.parse_document(temp_path, file_ext)
        parsed_text = (parsed_text or "").strip()
        return {
            "name": file.filename,
            "file_type": file_ext,
            "content": parsed_text[:16000],
            "truncated": len(parsed_text) > 16000,
        }
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/chat")
async def chat(
    request: ChatRequest,
    session: AsyncSession = Depends(get_session),
):
    """带会话持久化的基础聊天接口。"""
    # 先拉取压缩后的上下文，避免每次都发送完整历史。
    optimized_context = []
    if request.conversationId:
        optimized_context = await conversation_service.get_optimized_context(
            session=session,
            conversation_id=request.conversationId,
            current_model=request.model,
        )

        # 在调用模型前先保存用户消息。
        # 这样即使流式响应失败，历史里也还保留这次提示词。
        await conversation_service.add_message(
            session=session,
            conversation_id=request.conversationId,
            role="user",
            content=request.message,
            model=request.model,
        )

    async def generate():
        assistant_content = ""
        try:
            # 普通聊天走标准的 prompt 组装路径：
            # 历史消息 + 临时附件 + 可选的联网搜索工具。
            async for chunk in llm_service.stream_chat(
                message=request.message,
                api_key=request.apiKey,
                model=request.model,
                use_rag=False,
                use_memory=False,
                use_tools=request.use_tools,
                attachments=request.attachments,
                base_url=request.baseUrl,
                session=session,
                history=optimized_context,
            ):
                assistant_content += chunk
                yield chunk

            if request.conversationId:
                # 只有在流式输出完整结束后，才保存助手回复。
                await conversation_service.add_message(
                    session=session,
                    conversation_id=request.conversationId,
                    role="assistant",
                    content=assistant_content,
                    model=request.model,
                )

                # 如果对话还在用默认占位标题，就根据首轮问答生成一个简短标题。
                await conversation_service.generate_conversation_title(
                    session=session,
                    conversation_id=request.conversationId,
                    api_key=request.apiKey,
                    model=request.model,
                    base_url=request.baseUrl,
                )

                # 长对话会异步生成摘要，保持 prompt 尽量精简。
                should_summary = await conversation_service.should_generate_summary(
                    session=session,
                    conversation_id=request.conversationId,
                )
                if should_summary:
                    asyncio.create_task(
                        conversation_service.generate_summary(
                            session=session,
                            conversation_id=request.conversationId,
                            api_key=request.apiKey,
                        )
                    )

        except Exception as e:
            print(f"[Chat Error] {type(e).__name__}: {e}")
            traceback.print_exc()
            yield f"[ERROR]{str(e)}"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/chat/rag")
async def chat_with_rag(
    request: RAGChatRequest,
    session: AsyncSession = Depends(get_session),
):
    """增强版聊天接口，支持 RAG、记忆、附件和可选工具。"""
    optimized_context = []
    if request.conversationId:
        optimized_context = await conversation_service.get_optimized_context(
            session=session,
            conversation_id=request.conversationId,
            current_model=request.model,
        )

        # 先保存用户消息，方便后续步骤读取同一轮内容。
        await conversation_service.add_message(
            session=session,
            conversation_id=request.conversationId,
            role="user",
            content=request.message,
            model=request.model,
        )

    async def generate():
        assistant_content = ""
        try:
            # 这里是关键编排点：
            # - use_rag：从知识库检索相关片段
            # - use_memory：检索和问题相关的长期记忆
            # - use_tools：让模型在需要时调用 web_search
            # - attachments：注入当前会话的文件上下文
            async for chunk in llm_service.stream_chat(
                message=request.message,
                api_key=request.apiKey,
                model=request.model,
                use_rag=request.use_rag,
                use_memory=request.use_memory,
                use_tools=request.use_tools,
                attachments=request.attachments,
                base_url=request.baseUrl,
                session=session,
                history=optimized_context,
            ):
                assistant_content += chunk
                yield chunk

            if request.conversationId:
                # 只有流式输出结束后，才保存助手内容。
                await conversation_service.add_message(
                    session=session,
                    conversation_id=request.conversationId,
                    role="assistant",
                    content=assistant_content,
                    model=request.model,
                )

                await conversation_service.generate_conversation_title(
                    session=session,
                    conversation_id=request.conversationId,
                    api_key=request.apiKey,
                    model=request.model,
                    base_url=request.baseUrl,
                )

                # 摘要生成保持异步，避免阻塞用户响应。
                should_summary = await conversation_service.should_generate_summary(
                    session=session,
                    conversation_id=request.conversationId,
                )
                if should_summary:
                    asyncio.create_task(
                        conversation_service.generate_summary(
                            session=session,
                            conversation_id=request.conversationId,
                            api_key=request.apiKey,
                        )
                    )

                # 当启用记忆时，从聊天内容中异步抽取新的长期记忆。
                if request.use_memory:
                    asyncio.create_task(
                        _extract_memories_background(
                            conversation_id=request.conversationId,
                            api_key=request.apiKey,
                            provider=llm_service.infer_provider(
                                request.model, request.baseUrl
                            ),
                            base_url=request.baseUrl,
                        )
                    )

        except Exception as e:
            print(f"[RAG Chat Error] {type(e).__name__}: {e}")
            traceback.print_exc()
            yield f"[ERROR]{str(e)}"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/chat/attachments/preview")
async def preview_attachment(
    file: UploadFile = File(...),
):
    """解析上传文件，仅供临时聊天上下文使用。"""
    return await _parse_temporary_attachment(file)


@router.get("/tools")
async def list_tools():
    """暴露当前可用的工具，便于调试或界面查看。"""
    return {
        "tools": [
            {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.parameters,
            }
            for tool in tools_service.tools.values()
        ]
    }
