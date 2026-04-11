import asyncio
import os
import tempfile
import traceback

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from core.database import async_session_maker, get_session
from models.api_schemas import ChatRequest, RAGChatRequest
from models.entities import User
from services.conversation_service import conversation_service
from services.document_service import document_service
from services.llm_service import llm_service
from services.memory_service import memory_service
from services.tools_service import tools_service

router = APIRouter(prefix="/api", tags=["chat"])


async def _extract_memories_background(
    conversation_id: str,
    user_id: str,
    api_key: str,
    provider: str = "openai",
    base_url: str = None,
):
    try:
        async with async_session_maker() as session:
            messages = await conversation_service.get_recent_messages(
                session=session,
                conversation_id=conversation_id,
                user_id=user_id,
                limit=10,
            )
            if len(messages) < 2:
                return

            conversation_text = "\n".join(
                [f"{'User' if m.role == 'user' else 'Assistant'}: {m.content}" for m in messages]
            )
            await memory_service.extract_memories_from_conversation(
                conversation_text=conversation_text,
                api_key=api_key,
                session=session,
                user_id=user_id,
                provider=provider,
                base_url=base_url,
            )
    except Exception as exc:
        print(f"[Auto Memory Error] {type(exc).__name__}: {exc}")


async def _parse_temporary_attachment(file: UploadFile) -> dict:
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
    current_user: User = Depends(get_current_user),
):
    optimized_context = []
    if request.conversationId:
        optimized_context = await conversation_service.get_optimized_context(
            session=session,
            conversation_id=request.conversationId,
            user_id=current_user.id,
            current_model=request.model,
        )
        await conversation_service.add_message(
            session=session,
            conversation_id=request.conversationId,
            user_id=current_user.id,
            role="user",
            content=request.message,
            model=request.model,
        )

    async def generate():
        assistant_content = ""
        try:
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
                user_id=str(current_user.id),
                response_length=request.response_length,
            ):
                assistant_content += chunk
                yield chunk

            if request.conversationId:
                await conversation_service.add_message(
                    session=session,
                    conversation_id=request.conversationId,
                    user_id=current_user.id,
                    role="assistant",
                    content=assistant_content,
                    model=request.model,
                )
                await conversation_service.generate_conversation_title(
                    session=session,
                    conversation_id=request.conversationId,
                    user_id=current_user.id,
                    api_key=request.apiKey,
                    model=request.model,
                    base_url=request.baseUrl,
                )
                if await conversation_service.should_generate_summary(
                    session=session,
                    conversation_id=request.conversationId,
                    user_id=current_user.id,
                ):
                    asyncio.create_task(
                        conversation_service.generate_summary(
                            session=session,
                            conversation_id=request.conversationId,
                            user_id=current_user.id,
                            api_key=request.apiKey,
                        )
                    )
        except Exception as exc:
            print(f"[Chat Error] {type(exc).__name__}: {exc}")
            traceback.print_exc()
            yield f"[ERROR]{str(exc)}"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/chat/rag")
async def chat_with_rag(
    request: RAGChatRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    optimized_context = []
    if request.conversationId:
        optimized_context = await conversation_service.get_optimized_context(
            session=session,
            conversation_id=request.conversationId,
            user_id=current_user.id,
            current_model=request.model,
        )
        await conversation_service.add_message(
            session=session,
            conversation_id=request.conversationId,
            user_id=current_user.id,
            role="user",
            content=request.message,
            model=request.model,
        )

    async def generate():
        assistant_content = ""
        try:
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
                user_id=str(current_user.id),
                response_length=request.response_length,
            ):
                assistant_content += chunk
                yield chunk

            if request.conversationId:
                await conversation_service.add_message(
                    session=session,
                    conversation_id=request.conversationId,
                    user_id=current_user.id,
                    role="assistant",
                    content=assistant_content,
                    model=request.model,
                )
                await conversation_service.generate_conversation_title(
                    session=session,
                    conversation_id=request.conversationId,
                    user_id=current_user.id,
                    api_key=request.apiKey,
                    model=request.model,
                    base_url=request.baseUrl,
                )
                if await conversation_service.should_generate_summary(
                    session=session,
                    conversation_id=request.conversationId,
                    user_id=current_user.id,
                ):
                    asyncio.create_task(
                        conversation_service.generate_summary(
                            session=session,
                            conversation_id=request.conversationId,
                            user_id=current_user.id,
                            api_key=request.apiKey,
                        )
                    )
                if request.use_memory:
                    asyncio.create_task(
                        _extract_memories_background(
                            conversation_id=request.conversationId,
                            user_id=str(current_user.id),
                            api_key=request.apiKey,
                            provider=llm_service.infer_provider(request.model, request.baseUrl),
                            base_url=request.baseUrl,
                        )
                    )
        except Exception as exc:
            print(f"[RAG Chat Error] {type(exc).__name__}: {exc}")
            traceback.print_exc()
            yield f"[ERROR]{str(exc)}"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/chat/attachments/preview")
async def preview_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    return await _parse_temporary_attachment(file)


@router.get("/tools")
async def list_tools(current_user: User = Depends(get_current_user)):
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
