from datetime import datetime
import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

from core.constants import DEFAULT_MODEL_ID

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship("Document", back_populates="user")
    conversations = relationship("Conversation", back_populates="user")
    memories = relationship("Memory", back_populates="user")
    memory_settings = relationship("MemorySetting", back_populates="user")
    api_keys = relationship("UserApiKey", back_populates="user", cascade="all, delete-orphan")
    custom_models = relationship("CustomModel", back_populates="user", cascade="all, delete-orphan")
    interaction_metrics = relationship("InteractionMetric", back_populates="user")


class UserApiKey(Base):
    __tablename__ = "user_api_keys"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_user_api_keys_user_provider"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    provider = Column(String(50), nullable=False)
    encrypted_api_key = Column(Text, nullable=True)
    encrypted_base_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="api_keys")


class CustomModel(Base):
    __tablename__ = "custom_models"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", "model_id", name="uq_custom_models_user_provider_model"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    model_id = Column(String(100), nullable=False)
    display_name = Column(String(255), nullable=True)
    provider = Column(String(50), nullable=False)
    base_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    context_window = Column(Integer, nullable=True)
    pinned = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="custom_models")


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    title = Column(String(255))
    file_type = Column(String(50))
    file_path = Column(String(500))
    content_hash = Column(String(128), nullable=True, index=True)
    version = Column(Integer, default=1)
    is_latest = Column(Integer, default=1)
    source_name = Column(String(255), nullable=True)
    metadata_json = Column(Text, nullable=True)
    status = Column(String(20), default="processing")
    duplicate_of_document_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"))
    content = Column(Text)
    chunk_index = Column(Integer)
    chunk_hash = Column(String(128), nullable=True, index=True)
    token_count = Column(Integer, default=0)
    embedding = Column(Vector)

    document = relationship("Document", back_populates="chunks")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    title = Column(String(255))
    model = Column(String(100), default=DEFAULT_MODEL_ID)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    message_count = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    summary = Column(Text, nullable=True)
    summary_tokens = Column(Integer, default=0)

    user = relationship("User", back_populates="conversations")
    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"))
    role = Column(String(20))
    content = Column(Text)
    tokens = Column(Integer, default=0)
    is_summarized = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")


class Memory(Base):
    __tablename__ = "memories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    content = Column(Text, nullable=False)
    category = Column(String(50), default="fact")
    importance = Column(Integer, default=5)
    source = Column(String(255))
    normalized_key = Column(String(128), nullable=True, index=True)
    status = Column(String(20), default="active")
    expires_at = Column(DateTime, nullable=True)
    confidence = Column(Float, default=1.0)
    metadata_json = Column(Text, nullable=True)
    embedding = Column(Vector)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    access_count = Column(Integer, default=0)
    last_accessed = Column(DateTime)

    user = relationship("User", back_populates="memories")


class InteractionMetric(Base):
    __tablename__ = "interaction_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True)
    message_id = Column(UUID(as_uuid=True), nullable=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    model = Column(String(100), nullable=True)
    mode = Column(String(20), default="basic")
    use_rag = Column(Integer, default=0)
    use_memory = Column(Integer, default=0)
    use_tools = Column(Integer, default=0)
    is_regeneration = Column(Integer, default=0)
    top_k = Column(Integer, default=0)
    retrieved_count = Column(Integer, default=0)
    no_result = Column(Integer, default=1)
    citation_count = Column(Integer, default=0)
    citation_coverage = Column(Float, default=0.0)
    retrieval_hit_rate = Column(Float, default=0.0)
    answer_success = Column(Integer, default=0)
    first_try_answer = Column(Integer, default=0)
    follow_up_required = Column(Integer, default=0)
    hallucination_flag = Column(Integer, default=0)
    human_correction_flag = Column(Integer, default=0)
    retrieved_sources_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="interaction_metrics")


class MemorySetting(Base):
    __tablename__ = "memory_settings"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_memory_settings_user_key"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    key = Column(String(100), nullable=False)
    value = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="memory_settings")
