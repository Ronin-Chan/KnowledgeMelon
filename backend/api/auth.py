from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from core.database import get_session
from core.security import create_access_token, decrypt_secret, encrypt_secret, hash_password, verify_password
from models.api_schemas import (
    AuthResponse,
    StoredApiKeyPayload,
    StoredApiKeyResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from models.entities import User, UserApiKey

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _serialize_user(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        created_at=user.created_at,
    )


@router.post("/register", response_model=AuthResponse)
async def register(
    request: UserRegisterRequest,
    session: AsyncSession = Depends(get_session),
):
    existing = await session.execute(select(User).where(User.email == request.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already registered")

    user = User(
        username=request.username.strip(),
        email=request.email.lower(),
        password_hash=hash_password(request.password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return AuthResponse(
        access_token=create_access_token(str(user.id)),
        user=_serialize_user(user),
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    request: UserLoginRequest,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).where(User.email == request.email.lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    return AuthResponse(
        access_token=create_access_token(str(user.id)),
        user=_serialize_user(user),
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return _serialize_user(current_user)


@router.get("/api-keys", response_model=list[StoredApiKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(UserApiKey).where(UserApiKey.user_id == current_user.id).order_by(UserApiKey.provider.asc())
    )
    rows = result.scalars().all()
    return [
        StoredApiKeyResponse(
            provider=row.provider,
            api_key=decrypt_secret(row.encrypted_api_key) or "",
            base_url=decrypt_secret(row.encrypted_base_url) or "",
        )
        for row in rows
    ]


@router.put("/api-keys/{provider}", response_model=StoredApiKeyResponse)
async def upsert_api_key(
    provider: str,
    payload: StoredApiKeyPayload,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(UserApiKey).where(
            UserApiKey.user_id == current_user.id,
            UserApiKey.provider == provider,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        record = UserApiKey(user_id=current_user.id, provider=provider)
        session.add(record)

    record.encrypted_api_key = encrypt_secret(payload.api_key.strip())
    record.encrypted_base_url = encrypt_secret(payload.base_url.strip())
    await session.commit()
    await session.refresh(record)

    return StoredApiKeyResponse(
        provider=record.provider,
        api_key=payload.api_key.strip(),
        base_url=payload.base_url.strip(),
    )


@router.delete("/api-keys/{provider}")
async def delete_api_key(
    provider: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(UserApiKey).where(
            UserApiKey.user_id == current_user.id,
            UserApiKey.provider == provider,
        )
    )
    record = result.scalar_one_or_none()
    if record:
        await session.delete(record)
        await session.commit()
    return {"success": True}
