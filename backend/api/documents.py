from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import os
import asyncio
from datetime import datetime, timedelta

from core.database import get_session, async_session_maker
from models.database import Document, DocumentChunk
from models.schemas import DocumentResponse, DocumentListResponse
from services.document_service import document_service
from services.embedding_service import embedding_service
from services.rag_service import rag_service
from services.document_processor import document_processor

router = APIRouter(prefix="/api/documents", tags=["documents"])

PDF_PAGES_PER_REQUEST = 20
PDF_PARSE_TIMEOUT_SECONDS = 20
PROCESSING_TIMEOUT_MINUTES = 30


async def _reconcile_stuck_processing_documents() -> None:
    # 如果进程中断或任务失败，数据库里可能残留“processing”状态。
    # 这里定期把超时太久的任务标为 failed，避免前端永远显示处理中。
    cutoff = datetime.utcnow() - timedelta(minutes=PROCESSING_TIMEOUT_MINUTES)
    async with async_session_maker() as session:
        result = await session.execute(
            select(Document).where(
                Document.status == "processing", Document.created_at < cutoff
            )
        )
        stale_docs = result.scalars().all()
        if not stale_docs:
            return

        for doc in stale_docs:
            doc.status = "failed"

        await session.commit()


async def _process_document_async(
    document_id,
    file_path: str,
    file_ext: str,
    api_key: str,
    provider: str,
    base_url: str,
    use_local_embedding: bool,
):
    # 文档处理是一个后台异步任务：
    # 先建 job，再更新进度，最后写入 chunk 和 embedding。
    job_id = document_processor.create_job(str(document_id))
    document_processor.start_job(job_id)

    async with async_session_maker() as session:
        doc = await session.get(Document, document_id)
        if doc is None:
            document_processor.fail_job(job_id, "Document not found")
            return

        try:
            # PDF 额外能拿到页数，所以可以把“解析进度”做得更细。
            total_pages = 0
            if file_ext == ".pdf":
                doc_info = await asyncio.to_thread(document_service.get_pdf_info, file_path)
                total_pages = doc_info.get("total_pages", 0)
                document_processor.update_progress(job_id, 0, total_pages, "开始解析 PDF...")

            # 先把原始文件解析成纯文本，后续 chunk / embedding 都依赖这一步。
            text = await document_service.parse_document(file_path, file_ext)

            if file_ext == ".pdf" and not text.strip():
                doc.status = "failed"
                await session.commit()
                document_processor.fail_job(job_id, "PDF 未提取到可检索文本，可能是扫描版")
                return

            # 分块是为了让长文档更容易检索，也更不容易塞爆上下文窗口。
            document_processor.update_progress(job_id, total_pages // 2 if total_pages else 50, total_pages or 100, "正在分块...")

            chunks = document_service.chunk_text(text)

            if chunks:
                # embedding 生成是最慢的阶段之一，所以这里把每个 chunk 的进度都汇报给前端。
                document_processor.update_progress(
                    job_id,
                    total_pages * 3 // 4 if total_pages else 75,
                    total_pages or 100,
                    f"正在生成 0/{len(chunks)} 个向量...",
                )

                embeddings = []
                for i, chunk_text in enumerate(chunks):
                    # 每个 chunk 都单独生成 embedding，方便后续做相似度检索。
                    embedding = await embedding_service.get_single_embedding(
                        chunk_text,
                        api_key,
                        provider,
                        base_url if base_url else None,
                        use_local_embedding,
                    )
                    embeddings.append(embedding)
                    # 把当前 chunk 的完成情况写回 job，前端就能显示“正在生成向量 x/n”。
                    current_progress = (
                        int(75 + ((i + 1) / len(chunks)) * 25)
                        if len(chunks) > 0
                        else 100
                    )
                    document_processor.update_progress(
                        job_id,
                        current_progress,
                        100,
                        f"正在生成向量 {i + 1}/{len(chunks)}...",
                    )

                for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                    # chunk 和 embedding 一一对应写入数据库，后续 RAG 就从这里检索。
                    session.add(
                        DocumentChunk(
                            document_id=doc.id,
                            content=chunk_text,
                            chunk_index=i,
                            embedding=embedding,
                        )
                    )

            doc.status = "completed"
            await session.commit()
            document_processor.complete_job(job_id, len(chunks))
        except Exception as e:
            await session.rollback()
            doc = await session.get(Document, document_id)
            if doc is not None:
                doc.status = "failed"
                await session.commit()
            document_processor.fail_job(job_id, str(e))


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    api_key: str = "",
    provider: str = "openai",
    base_url: str = "",
    use_local_embedding: bool = False,
    session: AsyncSession = Depends(get_session),
):
    """上传并处理文档。"""
    # 只允许项目明确支持的文档类型，避免解析器处理未知格式。
    file_ext = os.path.splitext(file.filename)[1].lower()
    allowed_types = [".pdf", ".docx", ".txt", ".md"]

    if file_ext not in allowed_types:
        raise HTTPException(400, f"Unsupported file type. Allowed: {allowed_types}")

    # 如果不是本地 embedding，就必须提供外部模型的 API key。
    if not use_local_embedding and not api_key:
        raise HTTPException(
            400, f"API key required for {provider} embedding generation"
        )

    try:
        await _reconcile_stuck_processing_documents()

        # 先把原始文件读入内存，再保存到项目自己的上传目录。
        content = await file.read()

        # 保存原文件，后续预览 / 解析 / 下载都会用到。
        file_path, _ = await document_service.save_document(file.filename, content)

        # 数据库里只存元信息和文件路径，真正的文本和向量会在后台任务里补齐。
        document = Document(
            title=file.filename,
            file_type=file_ext,
            file_path=file_path,
            status="processing",
        )
        session.add(document)
        await session.commit()

        asyncio.create_task(
            _process_document_async(
                document.id,
                file_path,
                file_ext,
                api_key,
                provider,
                base_url,
                use_local_embedding,
            )
        )

        return {
            "id": str(document.id),
            "title": document.title,
            "status": document.status,
            "chunks_count": 0,
        }
    except Exception as e:
        await session.rollback()
        raise HTTPException(500, f"Error processing document: {str(e)}")


@router.get("/")
async def list_documents(session: AsyncSession = Depends(get_session)) -> List[dict]:
    """列出所有文档。"""
    # 每次拉列表前先清理一下超时的 processing 状态，避免前端卡在假处理中。
    await _reconcile_stuck_processing_documents()

    result = await session.execute(
        select(Document).order_by(Document.created_at.desc())
    )
    documents = result.scalars().all()

    return [
        {
            "id": str(doc.id),
            "title": doc.title,
            "file_type": doc.file_type,
            "status": doc.status,
            "created_at": doc.created_at.isoformat(),
        }
        for doc in documents
    ]


@router.get("/{document_id}/content")
async def get_document_content(
    document_id: str,
    start_page: int = 0,
    end_page: int = PDF_PAGES_PER_REQUEST,
    session: AsyncSession = Depends(get_session),
):
    """获取文档内容（解析后的文本），PDF 支持分页。"""
    from uuid import UUID

    try:
        parsed_id = UUID(document_id)
    except ValueError:
        raise HTTPException(400, "Invalid document_id")

    result = await session.execute(select(Document).where(Document.id == parsed_id))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    try:
        doc_info = {}
        if doc.file_type == ".pdf":
            # PDF 内容要分页取，避免一次性把超大文档全塞进前端。
            doc_info = await asyncio.to_thread(
                document_service.get_pdf_info, doc.file_path
            )

            total_pages = doc_info["total_pages"]
            start = max(0, start_page)
            requested_end = max(start, end_page)
            safe_end = min(
                total_pages, min(requested_end, start + PDF_PAGES_PER_REQUEST)
            )

            if start >= total_pages:
                return {
                    "id": str(doc.id),
                    "title": doc.title,
                    "file_type": doc.file_type,
                    "content": "",
                    "total_pages": total_pages,
                    "file_size_mb": doc_info["file_size_mb"],
                    "start_page": start,
                    "end_page": start,
                    "loaded_pages": 0,
                    "next_start_page": None,
                }

            try:
                # 这里真正读取 PDF 对应页的文本内容。
                text = await asyncio.wait_for(
                    document_service.parse_document(
                        doc.file_path,
                        doc.file_type,
                        start,
                        safe_end,
                    ),
                    timeout=PDF_PARSE_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                raise HTTPException(504, "PDF 解析超时，请缩小页面范围后重试")

            response = {
                "id": str(doc.id),
                "title": doc.title,
                "file_type": doc.file_type,
                "content": text,
                "total_pages": total_pages,
                "file_size_mb": doc_info["file_size_mb"],
                "start_page": start,
                "end_page": safe_end,
                "loaded_pages": max(0, safe_end - start),
                "next_start_page": safe_end if safe_end < total_pages else None,
            }

            return response

        text = await document_service.parse_document(doc.file_path, doc.file_type)

        response = {
            "id": str(doc.id),
            "title": doc.title,
            "file_type": doc.file_type,
            "content": text,
        }

        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error reading document: {str(e)}")


@router.get("/{document_id}/preview-info")
async def get_document_preview_info(
    document_id: str,
    session: AsyncSession = Depends(get_session),
):
    from uuid import UUID

    try:
        parsed_id = UUID(document_id)
    except ValueError:
        raise HTTPException(400, "Invalid document_id")

    result = await session.execute(select(Document).where(Document.id == parsed_id))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    if not os.path.exists(doc.file_path):
        raise HTTPException(404, "Document file not found")

    response = {
        "id": str(doc.id),
        "title": doc.title,
        "file_type": doc.file_type,
    }

    if doc.file_type == ".pdf":
        # 预览信息先返回总页数和文件大小，前端可以先展示阅读器框架。
        doc_info = await asyncio.to_thread(document_service.get_pdf_info, doc.file_path)
        response["total_pages"] = doc_info["total_pages"]
        response["file_size_mb"] = doc_info["file_size_mb"]

    return response


@router.get("/{document_id}/file")
async def get_document_file(
    document_id: str,
    session: AsyncSession = Depends(get_session),
):
    from uuid import UUID

    try:
        parsed_id = UUID(document_id)
    except ValueError:
        raise HTTPException(400, "Invalid document_id")

    result = await session.execute(select(Document).where(Document.id == parsed_id))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    if not os.path.exists(doc.file_path):
        raise HTTPException(404, "Document file not found")

    media_type = "application/octet-stream"
    if doc.file_type == ".pdf":
        media_type = "application/pdf"
    elif doc.file_type == ".txt":
        media_type = "text/plain; charset=utf-8"
    elif doc.file_type == ".md":
        media_type = "text/markdown; charset=utf-8"

    return FileResponse(
        path=doc.file_path,
        media_type=media_type,
        filename=doc.title,
        # inline 让浏览器优先直接预览，而不是强制下载。
        content_disposition_type="inline",
    )


@router.get("/{document_id}")
async def get_document(document_id: str, session: AsyncSession = Depends(get_session)):
    """获取文档详情。"""
    from uuid import UUID

    result = await session.execute(
        select(Document).where(Document.id == UUID(document_id))
    )
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    return {
        "id": str(doc.id),
        "title": doc.title,
        "file_type": doc.file_type,
        "status": doc.status,
        "created_at": doc.created_at.isoformat(),
    }


@router.get("/{document_id}/status")
async def get_document_status(
    document_id: str, session: AsyncSession = Depends(get_session)
):
    """获取文档处理状态及进度。"""
    from uuid import UUID

    try:
        parsed_id = UUID(document_id)
    except ValueError:
        raise HTTPException(400, "Invalid document_id")

    result = await session.execute(select(Document).where(Document.id == parsed_id))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    # 如果存在处理任务就一起返回。
    job = document_processor.get_job_by_document(str(doc.id))

    response = {
        "id": str(doc.id),
        "title": doc.title,
        "status": doc.status,
        "file_type": doc.file_type,
    }

    if job:
        response["progress"] = {
            "percent": job.progress,
            "current_page": job.current_page,
            "total_pages": job.total_pages,
            "message": job.message,
        }

    return response


@router.delete("/{document_id}")
async def delete_document(
    document_id: str, session: AsyncSession = Depends(get_session)
):
    """删除文档。"""
    from uuid import UUID

    result = await session.execute(
        select(Document).where(Document.id == UUID(document_id))
    )
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(404, "Document not found")

    # 删除文件。
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    await session.delete(doc)
    await session.commit()

    return {"message": "Document deleted"}


@router.post("/search")
async def search_documents(
    query: str,
    api_key: str = "",
    provider: str = "openai",
    base_url: str = "",
    limit: int = 5,
    session: AsyncSession = Depends(get_session),
):
    """搜索相关的文档分块。"""
    if not api_key:
        raise HTTPException(400, "API key required")

    chunks = await rag_service.search_similar(
        query, api_key, session, limit, provider, base_url if base_url else None
    )

    return [
        {
            "id": str(chunk.id),
            "content": chunk.content,
            "document_id": str(chunk.document_id),
            "chunk_index": chunk.chunk_index,
        }
        for chunk in chunks
    ]
