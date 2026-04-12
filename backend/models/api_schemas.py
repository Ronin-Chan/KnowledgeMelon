from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, EmailStr, Field


class ChatMessage(BaseModel):
    role: str
    content: str


class AttachmentInput(BaseModel):
    name: str
    file_type: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None
    conversationId: Optional[str] = None
    use_tools: bool = False
    attachments: Optional[List[AttachmentInput]] = None
    apiKey: str
    model: str = "gpt-5.1-mini"
    baseUrl: Optional[str] = None
    response_length: str = "balanced"
    is_regeneration: bool = False


class RAGChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None
    use_rag: bool = True
    use_memory: bool = True
    use_tools: bool = False
    attachments: Optional[List[AttachmentInput]] = None
    conversationId: Optional[str] = None
    apiKey: str
    model: str = "gpt-5.1-mini"
    baseUrl: Optional[str] = None
    response_length: str = "balanced"
    is_regeneration: bool = False


class DocumentResponse(BaseModel):
    id: str
    title: str
    file_type: str
    status: str
    created_at: datetime
    chunks_count: Optional[int] = None


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]


class SearchResult(BaseModel):
    id: str
    content: str
    document_id: str
    chunk_index: int


class RetrievedSource(BaseModel):
    id: str
    document_id: str
    document_title: str
    chunk_index: int
    content: str
    score: float
    explanation: str
    chunk_hash: Optional[str] = None


class RetrievalPreviewRequest(BaseModel):
    query: str
    apiKey: str
    provider: str = "openai"
    baseUrl: Optional[str] = None
    limit: int = 5


class InteractionMetricResponse(BaseModel):
    id: str
    question: str
    answer: Optional[str] = None
    model: Optional[str] = None
    mode: str
    top_k: int
    retrieved_count: int
    no_result: bool
    citation_count: int
    citation_coverage: float
    retrieval_hit_rate: float
    answer_success: bool
    first_try_answer: bool
    follow_up_required: bool
    hallucination_flag: bool
    human_correction_flag: bool
    retrieved_sources: List[dict[str, Any]]
    created_at: datetime


class MetricsSummaryResponse(BaseModel):
    usage: dict[str, Any]
    retrieval: dict[str, Any]
    quality: dict[str, Any]
    knowledge: dict[str, Any]
    memory: dict[str, Any]


class MemoryCreate(BaseModel):
    content: str
    category: str = "fact"
    importance: int = 5


class MemoryUpdate(BaseModel):
    content: Optional[str] = None
    importance: Optional[int] = None


class MemoryResponse(BaseModel):
    id: str
    content: str
    category: str
    importance: int
    source: str
    created_at: datetime
    access_count: int


class MemorySettingsResponse(BaseModel):
    auto_extract: bool
    whitelist_topics: List[str]
    blacklist_topics: List[str]
    min_importance: int
    memory_ttl_days: int = 180
    memory_conflict_policy: str = "latest_wins"


class UserRegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class StoredApiKeyPayload(BaseModel):
    provider: str
    api_key: str = ""
    base_url: str = ""


class StoredApiKeyResponse(BaseModel):
    provider: str
    api_key: str
    base_url: str
