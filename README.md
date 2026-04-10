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

### Configure the Environment

Create a `backend/.env` file if you need to override defaults:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/knowledge_melon
OPENAI_API_KEY=your_key_here
APP_SECRET=your_secret_here
```

If you are not using Docker Compose, adjust `DATABASE_URL` to match your local PostgreSQL setup.

### Start the App

Choose either one-click start or manual startup. You only need one of them.

#### One-click start

Run either of these from the repository root:

- `.\start-dev.ps1`
- `start-dev.bat`

Pick one, and it will automatically start PostgreSQL, wait for the database to become healthy, then launch the backend and frontend. You do not need to start them manually.

#### Start services manually

If you prefer to run each service yourself:

1. Start PostgreSQL

```bash
docker-compose up -d
```

2. Run the backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

3. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

### Local Ollama Embeddings (Optional)

The Knowledge page can use local embeddings through Ollama

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

Note: `start-dev.ps1` and `start-dev.bat` do not start Ollama for you. They only start PostgreSQL, the backend, and the frontend.

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

Or run `start-dev.bat` on Windows.

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
