# KnowledgeMelon

KnowledgeMelon is a local AI knowledge workspace for chatting with documents, storing long-term memories, and keeping a searchable knowledge base in one place.

## What It Does

- AI chat with conversation history
- Document upload and knowledge retrieval
- Long-term memory capture and management
- Multi-model support through the backend provider layer
- Local-first setup with PostgreSQL and pgvector

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

### 1. One-Click Start

From the repository root, run:

```powershell
.\start-dev.ps1
```

If you prefer double-clicking in Windows Explorer, run `start-dev.bat` instead.

This startup script starts PostgreSQL first, waits for the database container to become healthy, and then launches the backend and frontend.

### 2. Start PostgreSQL Manually

From the repository root:

```bash
docker-compose up -d
```

The database container is exposed on `localhost:5433`.

### 3. Configure the Backend

Create a `backend/.env` file if you need to override defaults:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/knowledge_melon
OPENAI_API_KEY=your_key_here
APP_SECRET=your_secret_here
```

If you are not using Docker Compose, adjust `DATABASE_URL` to match your local PostgreSQL setup.

### 4. Run the Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

The API runs at `http://localhost:8000`.

### 5. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

## Local Ollama Embeddings

The Knowledge page can use local embeddings through Ollama.

### How It Works

- The app checks `http://localhost:11434/api/tags` to detect a local Ollama instance.
- If it finds a local embedding model, the `Use local embeddings` toggle becomes available in the Knowledge page.
- The backend uses Ollama's embedding endpoint when `use_local_embedding` is enabled.

### Setup

1. Install Ollama.
2. Pull a local embedding model:

```bash
ollama pull nomic-embed-text
```

3. Make sure Ollama is running on `http://localhost:11434`.
4. If needed, start it with `ollama serve`.
5. Open the Knowledge page and enable `Use local embeddings`.

Note: `start-dev.ps1` does not start Ollama for you. It only starts PostgreSQL, the backend, and the frontend.

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

### Root

```powershell
.\start-dev.ps1
```

Or double-click `start-dev.bat` on Windows.

## API Overview

- `GET /` returns a basic service message
- `GET /health` returns service health
- `/api/chat` handles chat requests
- `/api/documents` manages the knowledge base
- `/api/memories` manages memory records and settings
- `/api/conversations` manages chat conversations

## Pages

- `/` home
- `/chat` conversation interface
- `/knowledge` document and knowledge management
- `/memories` memory management
- `/settings` application settings

## Notes

- The frontend talks to the backend at `http://localhost:8000` by default.
- If you change the backend host or port, set `NEXT_PUBLIC_API_URL` in the frontend environment.
