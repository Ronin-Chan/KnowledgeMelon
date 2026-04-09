from typing import Optional

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/knowledge_assistant"
    openai_api_key: Optional[str] = None
    app_secret: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
