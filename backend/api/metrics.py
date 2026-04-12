from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from core.database import get_session
from models.api_schemas import InteractionMetricResponse, MetricsSummaryResponse
from models.entities import User
from services.metrics_service import metrics_service

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


class InteractionReviewRequest(BaseModel):
    answer_success: Optional[bool] = None
    first_try_answer: Optional[bool] = None
    follow_up_required: Optional[bool] = None
    hallucination_flag: Optional[bool] = None
    human_correction_flag: Optional[bool] = None


@router.get("/summary", response_model=MetricsSummaryResponse)
async def metrics_summary(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await metrics_service.build_summary(session, current_user.id)


@router.get("/interactions", response_model=list[InteractionMetricResponse])
async def recent_interactions(
    limit: int = 20,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    rows = await metrics_service.list_recent_interactions(session, current_user.id, limit)
    response = []
    for row in rows:
        response.append(
            InteractionMetricResponse(
                id=str(row.id),
                question=row.question,
                answer=row.answer,
                model=row.model,
                mode=row.mode,
                top_k=row.top_k or 0,
                retrieved_count=row.retrieved_count or 0,
                no_result=bool(row.no_result),
                citation_count=row.citation_count or 0,
                citation_coverage=float(row.citation_coverage or 0.0),
                retrieval_hit_rate=float(row.retrieval_hit_rate or 0.0),
                answer_success=bool(row.answer_success),
                first_try_answer=bool(row.first_try_answer),
                follow_up_required=bool(row.follow_up_required),
                hallucination_flag=bool(row.hallucination_flag),
                human_correction_flag=bool(row.human_correction_flag),
                retrieved_sources=metrics_service._safe_load_sources(row.retrieved_sources_json),
                created_at=row.created_at,
            )
        )
    return response


@router.post("/interactions/{metric_id}/review", response_model=InteractionMetricResponse)
async def review_interaction(
    metric_id: str,
    request: InteractionReviewRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    metric = await metrics_service.review_interaction(
        session,
        metric_id=metric_id,
        user_id=current_user.id,
        answer_success=request.answer_success,
        first_try_answer=request.first_try_answer,
        follow_up_required=request.follow_up_required,
        hallucination_flag=request.hallucination_flag,
        human_correction_flag=request.human_correction_flag,
    )
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    return InteractionMetricResponse(
        id=str(metric.id),
        question=metric.question,
        answer=metric.answer,
        model=metric.model,
        mode=metric.mode,
        top_k=metric.top_k or 0,
        retrieved_count=metric.retrieved_count or 0,
        no_result=bool(metric.no_result),
        citation_count=metric.citation_count or 0,
        citation_coverage=float(metric.citation_coverage or 0.0),
        retrieval_hit_rate=float(metric.retrieval_hit_rate or 0.0),
        answer_success=bool(metric.answer_success),
        first_try_answer=bool(metric.first_try_answer),
        follow_up_required=bool(metric.follow_up_required),
        hallucination_flag=bool(metric.hallucination_flag),
        human_correction_flag=bool(metric.human_correction_flag),
        retrieved_sources=metrics_service._safe_load_sources(metric.retrieved_sources_json),
        created_at=metric.created_at,
    )
