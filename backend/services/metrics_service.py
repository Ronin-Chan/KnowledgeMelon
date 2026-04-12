import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.entities import Conversation, Document, InteractionMetric, Memory


class MetricsService:
    def _safe_load_sources(self, raw: Optional[str]) -> List[Dict[str, Any]]:
        if not raw:
            return []
        try:
            data = json.loads(raw)
            return data if isinstance(data, list) else []
        except Exception:
            return []

    async def record_interaction(
        self,
        session: AsyncSession,
        *,
        user_id,
        conversation_id: Optional[str],
        question: str,
        answer: str,
        model: Optional[str],
        mode: str,
        use_rag: bool,
        use_memory: bool,
        use_tools: bool,
        is_regeneration: bool,
        top_k: int = 0,
        retrieved_sources: Optional[List[Dict[str, Any]]] = None,
        answer_success: Optional[bool] = None,
        hallucination_flag: bool = False,
        human_correction_flag: bool = False,
    ) -> InteractionMetric:
        sources = retrieved_sources or []
        citation_count = len(sources)
        no_result = 1 if use_rag and citation_count == 0 else 0
        max_score = max((float(item.get("score") or 0.0) for item in sources), default=0.0)
        retrieval_hit_rate = 1.0 if use_rag and max_score >= 0.35 else 0.0
        citation_coverage = min(1.0, citation_count / max(1, top_k or 1)) if use_rag else 0.0
        final_answer_success = bool(answer_success if answer_success is not None else bool(answer.strip()))

        metric = InteractionMetric(
            user_id=user_id,
            conversation_id=conversation_id,
            question=question,
            answer=answer,
            model=model,
            mode=mode,
            use_rag=int(bool(use_rag)),
            use_memory=int(bool(use_memory)),
            use_tools=int(bool(use_tools)),
            is_regeneration=int(bool(is_regeneration)),
            top_k=top_k,
            retrieved_count=citation_count,
            no_result=no_result,
            citation_count=citation_count,
            citation_coverage=citation_coverage,
            retrieval_hit_rate=retrieval_hit_rate,
            answer_success=int(final_answer_success),
            first_try_answer=int(not is_regeneration),
            follow_up_required=int(bool(is_regeneration)),
            hallucination_flag=int(bool(hallucination_flag)),
            human_correction_flag=int(bool(human_correction_flag)),
            retrieved_sources_json=json.dumps(sources, ensure_ascii=False),
        )
        session.add(metric)
        await session.commit()
        await session.refresh(metric)
        return metric

    async def review_interaction(
        self,
        session: AsyncSession,
        *,
        metric_id: str,
        user_id,
        answer_success: Optional[bool] = None,
        first_try_answer: Optional[bool] = None,
        follow_up_required: Optional[bool] = None,
        hallucination_flag: Optional[bool] = None,
        human_correction_flag: Optional[bool] = None,
    ) -> Optional[InteractionMetric]:
        result = await session.execute(
            select(InteractionMetric).where(
                InteractionMetric.id == metric_id,
                InteractionMetric.user_id == user_id,
            )
        )
        metric = result.scalar_one_or_none()
        if not metric:
            return None

        if answer_success is not None:
            metric.answer_success = int(answer_success)
        if first_try_answer is not None:
            metric.first_try_answer = int(first_try_answer)
        if follow_up_required is not None:
            metric.follow_up_required = int(follow_up_required)
        if hallucination_flag is not None:
            metric.hallucination_flag = int(hallucination_flag)
        if human_correction_flag is not None:
            metric.human_correction_flag = int(human_correction_flag)
        await session.commit()
        await session.refresh(metric)
        return metric

    async def list_recent_interactions(
        self,
        session: AsyncSession,
        user_id,
        limit: int = 20,
    ) -> List[InteractionMetric]:
        result = await session.execute(
            select(InteractionMetric)
            .where(InteractionMetric.user_id == user_id)
            .order_by(InteractionMetric.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def build_summary(self, session: AsyncSession, user_id) -> Dict[str, Any]:
        total_conversations = await session.scalar(
            select(func.count(Conversation.id)).where(Conversation.user_id == user_id, Conversation.is_active == 1)
        )
        total_documents = await session.scalar(
            select(func.count(Document.id)).where(Document.user_id == user_id)
        )
        total_memories = await session.scalar(
            select(func.count(Memory.id)).where(Memory.user_id == user_id)
        )
        active_memories = await session.scalar(
            select(func.count(Memory.id)).where(Memory.user_id == user_id, Memory.status == "active")
        )
        expired_memories = await session.scalar(
            select(func.count(Memory.id)).where(Memory.user_id == user_id, Memory.status == "expired")
        )
        archived_documents = await session.scalar(
            select(func.count(Document.id)).where(Document.user_id == user_id, Document.status == "archived")
        )
        duplicate_documents = await session.scalar(
            select(func.count(Document.id)).where(Document.user_id == user_id, Document.status == "duplicate")
        )
        active_documents = await session.scalar(
            select(func.count(Document.id)).where(
                Document.user_id == user_id,
                Document.is_latest == 1,
                Document.status.in_(["completed", "processing"]),
            )
        )
        interactions = await session.execute(
            select(InteractionMetric).where(InteractionMetric.user_id == user_id)
        )
        rows = interactions.scalars().all()

        total_interactions = len(rows)
        rag_rows = [row for row in rows if row.use_rag]
        retrieval_hits = [row for row in rag_rows if row.retrieved_count > 0 and row.retrieval_hit_rate > 0]
        no_result_rows = [row for row in rag_rows if row.no_result]
        successful_rows = [row for row in rows if row.answer_success]
        first_try_rows = [row for row in rows if row.first_try_answer]
        hallucination_rows = [row for row in rows if row.hallucination_flag]
        correction_rows = [row for row in rows if row.human_correction_flag]

        avg = lambda values: round(sum(values) / len(values), 3) if values else 0.0

        return {
            "usage": {
                "conversations": int(total_conversations or 0),
                "documents": int(total_documents or 0),
                "memories": int(total_memories or 0),
                "interactions": total_interactions,
                "rag_interactions": len(rag_rows),
            },
            "retrieval": {
                "hit_rate": round(len(retrieval_hits) / len(rag_rows), 3) if rag_rows else 0.0,
                "no_result_rate": round(len(no_result_rows) / len(rag_rows), 3) if rag_rows else 0.0,
                "avg_top_k": avg([row.top_k for row in rag_rows]),
                "avg_retrieved_count": avg([row.retrieved_count for row in rag_rows]),
                "avg_citation_coverage": avg([float(row.citation_coverage or 0.0) for row in rag_rows]),
                "citation_coverage_rate": round(
                    len([row for row in rag_rows if row.citation_count > 0]) / len(rag_rows), 3
                ) if rag_rows else 0.0,
            },
            "quality": {
                "answer_success_rate": round(len(successful_rows) / total_interactions, 3) if total_interactions else 0.0,
                "one_shot_rate": round(len(first_try_rows) / total_interactions, 3) if total_interactions else 0.0,
                "follow_up_rate": round(
                    len([row for row in rows if row.follow_up_required]) / total_interactions, 3
                ) if total_interactions else 0.0,
                "hallucination_rate": round(len(hallucination_rows) / total_interactions, 3) if total_interactions else 0.0,
                "human_correction_rate": round(len(correction_rows) / total_interactions, 3) if total_interactions else 0.0,
            },
            "knowledge": {
                "archived_documents": int(archived_documents or 0),
                "duplicate_documents": int(duplicate_documents or 0),
                "active_documents": int(active_documents or 0),
            },
            "memory": {
                "active_memories": int(active_memories or 0),
                "expired_memories": int(expired_memories or 0),
            },
        }


metrics_service = MetricsService()
