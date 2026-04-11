import asyncio
import os
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from core.database import async_session_maker, get_session
from models.entities import Document, DocumentChunk, User
from services.document_processor import document_processor
from services.document_service import document_service
from services.embedding_service import embedding_service
from services.rag_service import rag_service

router = APIRouter(prefix="/api/documents", tags=["documents"])

PDF_PAGES_PER_REQUEST = 20
PDF_PARSE_TIMEOUT_SECONDS = 20
PROCESSING_TIMEOUT_MINUTES = 30


async def _reconcile_stuck_processing_documents(user_id) -> None:
    cutoff = datetime.utcnow() - timedelta(minutes=PROCESSING_TIMEOUT_MINUTES)
    async with async_session_maker() as session:
        result = await session.execute(
            select(Document).where(
                Document.user_id == user_id,
                Document.status == "processing",
                Document.created_at < cutoff,
            )
        )
        stale_docs = result.scalars().all()
        for doc in stale_docs:
            doc.status = "failed"
        if stale_docs:
            await session.commit()


async def _process_document_async(
    document_id,
    user_id,
    file_path: str,
    file_ext: str,
    api_key: str,
    provider: str,
    base_url: str,
    use_local_embedding: bool,
):
    job_id = document_processor.create_job(str(document_id))
    document_processor.start_job(job_id)

    async with async_session_maker() as session:
        doc = await session.get(Document, document_id)
        if doc is None or doc.user_id != user_id:
            document_processor.fail_job(job_id, "Document not found")
            return

        try:
            total_pages = 0
            if file_ext == ".pdf":
                doc_info = await asyncio.to_thread(document_service.get_pdf_info, file_path)
                total_pages = doc_info.get("total_pages", 0)
                document_processor.update_progress(job_id, 0, total_pages, "Parsing PDF")

            text = await document_service.parse_document(file_path, file_ext)
            if file_ext == ".pdf" and not text.strip():
                doc.status = "failed"
                await session.commit()
                document_processor.fail_job(job_id, "No searchable text found in PDF")
                return

            document_processor.update_progress(job_id, total_pages // 2 if total_pages else 50, total_pages or 100, "Chunking document")
            chunks = document_service.chunk_text(text)
            embeddings = []
            for index, chunk_text in enumerate(chunks):
                embedding = await embedding_service.get_single_embedding(
                    chunk_text,
                    api_key,
                    provider,
                    base_url if base_url else None,
                    use_local_embedding,
                )
                embeddings.append(embedding)
                current_progress = int(75 + ((index + 1) / len(chunks)) * 25) if chunks else 100
                document_processor.update_progress(job_id, current_progress, 100, f"Embedding {index + 1}/{len(chunks)}")

            for index, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                session.add(DocumentChunk(document_id=doc.id, content=chunk_text, chunk_index=index, embedding=embedding))

            doc.status = "completed"
            await session.commit()
            document_processor.complete_job(job_id, len(chunks))
        except Exception as exc:
            await session.rollback()
            doc = await session.get(Document, document_id)
            if doc is not None:
                doc.status = "failed"
                await session.commit()
            document_processor.fail_job(job_id, str(exc))


async def _get_owned_document(session: AsyncSession, document_id: str, user_id) -> Document:
    from uuid import UUID

    try:
        parsed_id = UUID(document_id)
    except ValueError as exc:
        raise HTTPException(400, "Invalid document_id") from exc

    result = await session.execute(
        select(Document).where(Document.id == parsed_id, Document.user_id == user_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    api_key: str = "",
    provider: str = "openai",
    base_url: str = "",
    use_local_embedding: bool = False,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    file_ext = os.path.splitext(file.filename)[1].lower()
    allowed_types = [".pdf", ".docx", ".txt", ".md"]
    if file_ext not in allowed_types:
        raise HTTPException(400, f"Unsupported file type. Allowed: {allowed_types}")
    if not use_local_embedding and not api_key:
        raise HTTPException(400, f"API key required for {provider} embedding generation")

    await _reconcile_stuck_processing_documents(current_user.id)
    content = await file.read()
    file_path, _ = await document_service.save_document(file.filename, content, str(current_user.id))

    document = Document(
        user_id=current_user.id,
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
            current_user.id,
            file_path,
            file_ext,
            api_key,
            provider,
            base_url,
            use_local_embedding,
        )
    )

    return {"id": str(document.id), "title": document.title, "status": document.status, "chunks_count": 0}


@router.get("/")
async def list_documents(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> List[dict]:
    await _reconcile_stuck_processing_documents(current_user.id)
    result = await session.execute(
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
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
    current_user: User = Depends(get_current_user),
):
    doc = await _get_owned_document(session, document_id, current_user.id)
    try:
        if doc.file_type == ".pdf":
            doc_info = await asyncio.to_thread(document_service.get_pdf_info, doc.file_path)
            total_pages = doc_info["total_pages"]
            start = max(0, start_page)
            safe_end = min(total_pages, min(max(start, end_page), start + PDF_PAGES_PER_REQUEST))
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
            text = await asyncio.wait_for(
                document_service.parse_document(doc.file_path, doc.file_type, start, safe_end),
                timeout=PDF_PARSE_TIMEOUT_SECONDS,
            )
            return {
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

        text = await document_service.parse_document(doc.file_path, doc.file_type)
        return {"id": str(doc.id), "title": doc.title, "file_type": doc.file_type, "content": text}
    except asyncio.TimeoutError as exc:
        raise HTTPException(504, "PDF parsing timed out") from exc
    except Exception as exc:
        raise HTTPException(500, f"Error reading document: {str(exc)}") from exc


@router.get("/{document_id}/preview-info")
async def get_document_preview_info(
    document_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doc = await _get_owned_document(session, document_id, current_user.id)
    response = {"id": str(doc.id), "title": doc.title, "file_type": doc.file_type}
    if doc.file_type == ".pdf":
        doc_info = await asyncio.to_thread(document_service.get_pdf_info, doc.file_path)
        response["total_pages"] = doc_info["total_pages"]
        response["file_size_mb"] = doc_info["file_size_mb"]
    return response


@router.get("/{document_id}/file")
async def get_document_file(
    document_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doc = await _get_owned_document(session, document_id, current_user.id)
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
        content_disposition_type="inline",
    )


@router.get("/{document_id}")
async def get_document(
    document_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doc = await _get_owned_document(session, document_id, current_user.id)
    return {
        "id": str(doc.id),
        "title": doc.title,
        "file_type": doc.file_type,
        "status": doc.status,
        "created_at": doc.created_at.isoformat(),
    }


@router.get("/{document_id}/status")
async def get_document_status(
    document_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doc = await _get_owned_document(session, document_id, current_user.id)
    job = document_processor.get_job_by_document(str(doc.id))
    response = {"id": str(doc.id), "title": doc.title, "status": doc.status, "file_type": doc.file_type}
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
    document_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    doc = await _get_owned_document(session, document_id, current_user.id)
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
    current_user: User = Depends(get_current_user),
):
    if not api_key:
        raise HTTPException(400, "API key required")
    chunks = await rag_service.search_similar(
        query,
        api_key,
        session,
        current_user.id,
        limit,
        provider,
        base_url if base_url else None,
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
