from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5433/knowledge_melon"
    openai_api_key: Optional[str] = None
    app_secret: str = "development-secret-change-me"
    access_token_expire_hours: int = 24
    ollama_base_url: str = "http://localhost:11434"
    ollama_embedding_model: str = "nomic-embed-text"
    ollama_api_key: Optional[str] = None
    ollama_username: Optional[str] = None
    ollama_password: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

settings = Settings()
