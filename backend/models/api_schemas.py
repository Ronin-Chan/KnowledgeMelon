from datetime import datetime
from typing import List, Optional

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


class RAGChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None
    use_rag: bool = True
    use_memory: bool = True
    use_tools: bool = False
    attachments: Optional[List[AttachmentInput]] = None
    conversationId: Optional[str] = None
    apiKey: str
    model: str = "gpt-4.1-mini"
    baseUrl: Optional[str] = None


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
