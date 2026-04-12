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
        "ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS content_hash VARCHAR(128)",
        "ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1",
        "ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS is_latest INTEGER DEFAULT 1",
        "ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS source_name VARCHAR(255)",
        "ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS metadata_json TEXT",
        "ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS duplicate_of_document_id UUID",
        "ALTER TABLE IF EXISTS document_chunks ADD COLUMN IF NOT EXISTS chunk_hash VARCHAR(128)",
        "ALTER TABLE IF EXISTS document_chunks ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0",
        "ALTER TABLE IF EXISTS conversations ADD COLUMN IF NOT EXISTS user_id UUID",
        "ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS user_id UUID",
        "ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS normalized_key VARCHAR(128)",
        "ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'",
        "ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP",
        "ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION DEFAULT 1.0",
        "ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS metadata_json TEXT",
        "ALTER TABLE IF EXISTS memory_settings ADD COLUMN IF NOT EXISTS user_id UUID",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS user_id UUID",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS conversation_id UUID",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS message_id UUID",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS question TEXT",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS answer TEXT",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS model VARCHAR(100)",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'basic'",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS use_rag INTEGER DEFAULT 0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS use_memory INTEGER DEFAULT 0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS use_tools INTEGER DEFAULT 0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS is_regeneration INTEGER DEFAULT 0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS top_k INTEGER DEFAULT 0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS retrieved_count INTEGER DEFAULT 0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS no_result INTEGER DEFAULT 1",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS citation_count INTEGER DEFAULT 0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS citation_coverage DOUBLE PRECISION DEFAULT 0.0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS retrieval_hit_rate DOUBLE PRECISION DEFAULT 0.0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS answer_success INTEGER DEFAULT 0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS first_try_answer INTEGER DEFAULT 0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS follow_up_required INTEGER DEFAULT 0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS hallucination_flag INTEGER DEFAULT 0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS human_correction_flag INTEGER DEFAULT 0",
        "ALTER TABLE IF EXISTS interaction_metrics ADD COLUMN IF NOT EXISTS retrieved_sources_json TEXT",
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
        "CREATE INDEX IF NOT EXISTS ix_documents_user_hash ON documents (user_id, content_hash)",
        "CREATE INDEX IF NOT EXISTS ix_documents_user_title ON documents (user_id, title)",
        "CREATE INDEX IF NOT EXISTS ix_memories_user_key ON memories (user_id, normalized_key)",
        "CREATE INDEX IF NOT EXISTS ix_interaction_metrics_user_created ON interaction_metrics (user_id, created_at)",
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
