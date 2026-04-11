# KnowledgeMelon

KnowledgeMelon is an AI knowledge workspace for chatting with documents, storing long-term memories, and keeping a searchable knowledge base in one place.

## What It Does

- AI chat with conversation history
- Document upload and knowledge retrieval
- Long-term memory capture and management
- Multi-model support through the backend provider layer
- Local-first setup with PostgreSQL and pgvector
- Optional Ollama endpoint for embeddings

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Zustand
- shadcn/ui-style components

### Backend

- FastAPI
- SQLAlchemy async
- PostgreSQL with pgvector
- Python 3.13
- Ollama integration for embeddings

### AI

- LangChain
- LangChain OpenAI
- LiteLLM
- OpenAI Python SDK
- Tiktoken
- ZhipuAI SDK

## Project Structure

```text
KnowledgeMelon/
  frontend/    Next.js app
  backend/     FastAPI service
  docker-compose.yml
  README.md
```

## Requirements

- Node.js 20 or newer
- Python 3.13 or newer
- Docker and Docker Compose

## Getting Started

### Configure the Environment

Create a `backend/.env` file:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/knowledge_melon
OPENAI_API_KEY=your_key_here
APP_SECRET=your_secret_here
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
# Optional if your Ollama endpoint requires credentials:
# OLLAMA_API_KEY=your_token_here
# OLLAMA_USERNAME=your_username
# OLLAMA_PASSWORD=your_password
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://your-backend-host:8000
```

You can also use your own Ollama server. Just update `OLLAMA_BASE_URL` in `backend/.env` to point to that server.

An example `docker-compose.ollama.yml` is included for your information.

### Start the App

The simplest setup is:

1. Start the backend stack

```bash
docker-compose up -d
```

This starts:

- `postgres`
- `backend`

2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### Ollama Embeddings

The Knowledge page can use any Ollama endpoint configured in `backend/.env`.

### How It Works

- The frontend checks the backend's `/api/ollama/status` endpoint.
- If the configured Ollama endpoint is reachable, the `Enable Self-Ollama` toggle becomes available in the Knowledge page.
- If the embedding model is not present yet, the backend pulls it automatically the first time it is needed.

### Setup

1. Set `OLLAMA_BASE_URL` in `backend/.env` to the Ollama server you want to use.
2. Add credentials if that endpoint requires them.
3. Start the backend stack with Docker Compose.
4. Open the Knowledge page.
5. Enable `Self-Ollama` once the service is available.

## Useful Scripts

### Frontend

```bash
npm run dev
npm run build
npm run start
npm run lint
```

### Backend

```bash
python main.py
uvicorn main:app --reload
```

## API Overview

- `GET /` returns a basic service message
- `GET /health` returns service health
- `/api/chat` handles chat requests
- `/api/documents` manages the knowledge base
- `/api/memories` manages memory records and settings
- `/api/conversations` manages chat conversations
- `/api/ollama/status` checks the configured Ollama endpoint

## Pages

- `/` home
- `/chat` conversation interface
- `/knowledge` document and knowledge management
- `/memories` memory management
- `/settings` application settings

## Notes

- The frontend talks to the backend at `http://localhost:8000` by default.
- Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` whenever the backend host or port is not the default `http://localhost:8000`.
- The backend stack runs together on a single machine with Docker Compose, while the frontend can be deployed separately.
- If you want a local Ollama server, use `docker-compose.ollama.yml`; if you host Ollama elsewhere, update `OLLAMA_BASE_URL` in `backend/.env` to point at it.
