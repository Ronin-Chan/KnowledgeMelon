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

### 1. Start PostgreSQL

From the repository root:

```bash
docker-compose up -d
```

The database container is exposed on `localhost:5433`.

### 2. Configure the Backend

Create a `backend/.env` file if you need to override defaults:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/knowledge_melon
OPENAI_API_KEY=your_key_here
APP_SECRET=your_secret_here
```

If you are not using Docker Compose, adjust `DATABASE_URL` to match your local PostgreSQL setup.

### 3. Run the Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

The API runs at `http://localhost:8000`.

### 4. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

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

## Pages

- `/` home
- `/chat` conversation interface
- `/knowledge` document and knowledge management
- `/memories` memory management
- `/settings` application settings

## Notes

- The frontend talks to the backend at `http://localhost:8000` by default.
- If you change the backend host or port, set `NEXT_PUBLIC_API_URL` in the frontend environment.
