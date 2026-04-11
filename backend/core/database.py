from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.config import settings
from models.entities import Base

engine = create_async_engine(
    settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
    echo=False,
)

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _ensure_schema_updates(conn) -> None:
    statements = [
        "ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS user_id UUID",
        "ALTER TABLE IF EXISTS conversations ADD COLUMN IF NOT EXISTS user_id UUID",
        "ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS user_id UUID",
        "ALTER TABLE IF EXISTS memory_settings ADD COLUMN IF NOT EXISTS user_id UUID",
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'memory_settings_key_key'
            ) THEN
                ALTER TABLE memory_settings DROP CONSTRAINT memory_settings_key_key;
            END IF;
        END $$;
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_memory_settings_user_key ON memory_settings (user_id, key)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_api_keys_user_provider ON user_api_keys (user_id, provider)",
    ]

    for statement in statements:
        await conn.execute(text(statement))


async def init_db():
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_schema_updates(conn)


async def get_session():
    async with async_session_maker() as session:
        yield session
