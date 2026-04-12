import re
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.entities import Document, DocumentChunk
from services.embedding_service import embedding_service


class RAGService:
    def _extract_keywords(self, text: str) -> set[str]:
        return {
            token
            for token in re.findall(r"[A-Za-z0-9\u4e00-\u9fff]{2,}", text.lower())
            if token
        }

    def _chunk_score(self, query: str, content: str, distance: float) -> tuple[float, str]:
        query_terms = self._extract_keywords(query)
        chunk_terms = self._extract_keywords(content)
        overlap = sorted(query_terms & chunk_terms)
        lexical_score = len(overlap) / max(1, len(query_terms))
        semantic_score = max(0.0, 1.0 - float(distance))
        score = round((semantic_score * 0.75) + (lexical_score * 0.25), 4)
        if overlap:
            reason = f"matched terms: {', '.join(overlap[:5])}"
        else:
            reason = "semantic similarity"
        return score, reason

    async def search_similar(
        self,
        query: str,
        api_key: str,
        session: AsyncSession,
        user_id,
        limit: int = 5,
        provider: str = "openai",
        base_url: str = None,
    ) -> List[DocumentChunk]:
        query_embedding = await embedding_service.get_single_embedding(query, api_key, provider, base_url)
        result = await session.execute(
            select(DocumentChunk)
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(Document.user_id == user_id)
            .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
            .limit(limit)
        )
        return result.scalars().all()

    async def preview_similar(
        self,
        query: str,
        api_key: str,
        session: AsyncSession,
        user_id,
        limit: int = 5,
        provider: str = "openai",
        base_url: str = None,
    ) -> List[dict]:
        query_embedding = await embedding_service.get_single_embedding(query, api_key, provider, base_url)
        result = await session.execute(
            select(DocumentChunk, Document.title)
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(Document.user_id == user_id)
            .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
            .limit(limit)
        )
        preview_rows: List[dict] = []
        rows = result.all()
        total = max(1, len(rows))
        for rank, (chunk, title) in enumerate(rows):
            distance_proxy = rank / total
            score, reason = self._chunk_score(query, chunk.content, distance_proxy)
            preview_rows.append(
                {
                    "id": str(chunk.id),
                    "document_id": str(chunk.document_id),
                    "document_title": title,
                    "chunk_index": chunk.chunk_index,
                    "content": chunk.content,
                    "score": score,
                    "reason": reason,
                    "chunk_hash": getattr(chunk, "chunk_hash", None),
                }
            )
        return preview_rows

    async def get_context_for_query(
        self,
        query: str,
        api_key: str,
        session: AsyncSession,
        user_id,
        limit: int = 5,
        provider: str = "openai",
        base_url: str = None,
    ) -> str:
        chunks = await self.search_similar(query, api_key, session, user_id, limit, provider, base_url)
        if not chunks:
            return ""
        return "\n\n".join(chunk.content for chunk in chunks)


rag_service = RAGService()
