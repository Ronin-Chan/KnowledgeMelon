from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.entities import Document, DocumentChunk
from services.embedding_service import embedding_service


class RAGService:
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
