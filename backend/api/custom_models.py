from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from core.database import get_session
from models.api_schemas import CustomModelCreate, CustomModelResponse, CustomModelUpdate
from models.entities import CustomModel, User

router = APIRouter(prefix="/api/custom-models", tags=["custom-models"])


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def _serialize_custom_model(model: CustomModel) -> CustomModelResponse:
    return CustomModelResponse(
        id=str(model.id),
        model_id=model.model_id,
        display_name=model.display_name,
        provider=model.provider,
        base_url=model.base_url,
        description=model.description,
        context_window=model.context_window,
        pinned=bool(model.pinned),
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


@router.get("", response_model=list[CustomModelResponse])
async def list_custom_models(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(CustomModel)
        .where(CustomModel.user_id == current_user.id)
        .order_by(CustomModel.pinned.desc(), CustomModel.created_at.asc())
    )
    rows = result.scalars().all()
    return [_serialize_custom_model(row) for row in rows]


async def _find_conflicting_model(
    session: AsyncSession,
    current_user: User,
    provider: str,
    model_id: str,
    exclude_id: str | None = None,
) -> CustomModel | None:
    query = select(CustomModel).where(
        CustomModel.user_id == current_user.id,
        CustomModel.provider == provider,
        CustomModel.model_id == model_id,
    )
    if exclude_id is not None:
        query = query.where(CustomModel.id != exclude_id)
    result = await session.execute(query)
    return result.scalar_one_or_none()


@router.post("", response_model=CustomModelResponse)
async def create_custom_model(
    payload: CustomModelCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    existing = await _find_conflicting_model(
        session,
        current_user,
        payload.provider,
        payload.model_id.strip(),
    )
    if existing:
        existing.display_name = _normalize_optional_text(payload.display_name)
        existing.base_url = _normalize_optional_text(payload.base_url)
        existing.description = _normalize_optional_text(payload.description)
        existing.context_window = payload.context_window
        existing.pinned = 1 if payload.pinned else 0
        await session.commit()
        await session.refresh(existing)
        return _serialize_custom_model(existing)

    model = CustomModel(
        user_id=current_user.id,
        model_id=payload.model_id.strip(),
        display_name=_normalize_optional_text(payload.display_name),
        provider=payload.provider,
        base_url=_normalize_optional_text(payload.base_url),
        description=_normalize_optional_text(payload.description),
        context_window=payload.context_window,
        pinned=1 if payload.pinned else 0,
    )
    session.add(model)
    await session.commit()
    await session.refresh(model)
    return _serialize_custom_model(model)


@router.put("/{model_id}", response_model=CustomModelResponse)
async def update_custom_model(
    model_id: str,
    payload: CustomModelUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(CustomModel).where(
            CustomModel.id == model_id,
            CustomModel.user_id == current_user.id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom model not found")

    conflicting = await _find_conflicting_model(
        session,
        current_user,
        payload.provider,
        payload.model_id.strip(),
        exclude_id=str(record.id),
    )
    if conflicting:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A custom model with this provider and model ID already exists",
        )

    record.model_id = payload.model_id.strip()
    record.display_name = _normalize_optional_text(payload.display_name)
    record.provider = payload.provider
    record.base_url = _normalize_optional_text(payload.base_url)
    record.description = _normalize_optional_text(payload.description)
    record.context_window = payload.context_window
    record.pinned = 1 if payload.pinned else 0
    await session.commit()
    await session.refresh(record)
    return _serialize_custom_model(record)


@router.delete("/{model_id}")
async def delete_custom_model(
    model_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(CustomModel).where(
            CustomModel.id == model_id,
            CustomModel.user_id == current_user.id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom model not found")

    await session.delete(record)
    await session.commit()
    return {"success": True}
