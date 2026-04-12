# KnowledgeMelon

KnowledgeMelon is a personal AI knowledge workspace built around three ideas: retrieve your own knowledge, remember what matters, and make every answer traceable.

It combines document-based **RAG**, long-term memory, conversation summarization, and an insights dashboard into one product-style workspace.

---

## English

### Project Overview

KnowledgeMelon is a full-stack AI assistant for a private, searchable, and memory-aware knowledge workspace.

The project focuses on a few practical goals:

- chat with your documents instead of relying only on model memory
- preserve user preferences and long-term facts
- keep conversations manageable even when they become long
- inspect retrieval quality and answer quality instead of treating the model as a black box

### Key Highlights

- Multi-model chat support through a unified provider layer
- RAG pipeline with document upload, parsing, chunking, embeddings, and similarity search
- Long-term memory with TTL, conflict policy, and auto-extraction from conversations
- Conversation summarization to keep context compact and stable
- Answer citations and source previews to make responses explainable
- Metrics dashboard for retrieval quality, answer quality, knowledge health, and memory health
- User-level data isolation so each account keeps its own knowledge base and memories
- Local-first architecture with PostgreSQL, pgvector, and optional Ollama embeddings

### Tech Stack

#### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Zustand
- Radix UI / shadcn-style components
- Lucide React
- React Markdown

#### Backend

- FastAPI
- SQLAlchemy async
- PostgreSQL
- pgvector
- Python 3.13
- Pydantic v2
- Uvicorn

#### AI and Retrieval

- LangChain
- LiteLLM
- OpenAI SDK
- LangChain OpenAI
- Tiktoken
- ZhipuAI SDK
- Ollama integration

#### Document Processing

- PyMuPDF
- pdfplumber
- python-docx
- RapidOCR

### Project Structure

```text
KnowledgeMelon/
  frontend/        Next.js App Router application
    app/           Pages and route-level UI
    components/    Shared UI and layout components
    lib/           API helpers, i18n, utilities
    stores/        Zustand state stores
  backend/         FastAPI service
    api/           Route handlers
    services/      Business logic
    models/        SQLAlchemy entities and schemas
    core/          Database, auth, settings
  docker-compose.yml
  README.md
```

### How to Run

#### Prerequisites

- Node.js 20 or newer
- Python 3.13 or newer
- Docker and Docker Compose

#### 1. Configure the backend

Create `backend/.env`:

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

#### 2. Configure the frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### 3. Start the database and backend

```bash
docker-compose up -d
```

This starts the local PostgreSQL + pgvector stack and the backend service.

#### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open the app in your browser and sign in or register to start using the workspace.

---

## 中文

### 项目简介

KnowledgeMelon 是一个面向个人知识管理的 AI 工作台，核心目标是把“聊天、知识库、记忆、可追溯回答”整合到一个完整产品里。

它是一个更接近真实业务场景的 **RAG** 系统：

- 能上传自己的文档并基于知识库回答
- 能记住用户的长期偏好和重要事实
- 能把长对话压缩成摘要，避免上下文无限膨胀
- 能展示引用来源和检索结果，让回答可解释
- 能通过指标面板观察检索质量和回答质量

### 特色介绍

- **多模型统一接入**  
  通过统一的 provider 层支持多种模型，不需要为每个模型单独写一套聊天逻辑。

- **完整的 RAG 链路**  
  文档上传后会经历解析、切块、向量化、相似度检索，再进入回答生成流程。

- **长期记忆系统**  
  支持记忆 TTL、冲突策略、自动抽取和向量检索，适合保存用户偏好和长期事实。

- **对话摘要机制**  
  当会话变长时自动生成摘要，只保留关键决策和未解决问题，减少上下文浪费。

- **引用与来源展示**  
  回答不是黑盒输出，前端会展示检索来源，方便用户理解答案来自哪里。

- **指标面板**  
  不只看“能不能答”，还看检索命中率、无结果率、引用覆盖率、回答成功率等。

- **用户级数据隔离**  
  每个用户只访问自己的知识库、记忆和对话记录，结构清晰，安全边界明确。

- **本地优先部署**  
  使用 PostgreSQL + pgvector 做核心存储，也支持 Ollama 作为本地 embedding 能力来源。

### 技术栈

#### 前端

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Zustand
- Radix UI / shadcn 风格组件
- Lucide React
- React Markdown

#### 后端

- FastAPI
- SQLAlchemy 异步 ORM
- PostgreSQL
- pgvector
- Python 3.13
- Pydantic v2
- Uvicorn

#### AI 与检索

- LangChain
- LiteLLM
- OpenAI SDK
- LangChain OpenAI
- Tiktoken
- ZhipuAI SDK
- Ollama 集成

#### 文档处理

- PyMuPDF
- pdfplumber
- python-docx
- RapidOCR

### 项目结构

```text
KnowledgeMelon/
  frontend/        Next.js 前端应用
    app/           页面与路由级 UI
    components/    公共组件与布局
    lib/           API、国际化、工具函数
    stores/        Zustand 状态管理
  backend/         FastAPI 后端服务
    api/           路由层
    services/      业务逻辑层
    models/        ORM 实体与数据结构
    core/          数据库、认证、配置
  docker-compose.yml
  README.md
```

### 怎么跑

#### 1. 准备环境

- Node.js 20 或以上
- Python 3.13 或以上
- Docker 和 Docker Compose

#### 2. 配置后端

创建 `backend/.env`：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/knowledge_melon
OPENAI_API_KEY=your_key_here
APP_SECRET=your_secret_here
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
# 如果 Ollama 需要认证，可以继续配置：
# OLLAMA_API_KEY=your_token_here
# OLLAMA_USERNAME=your_username
# OLLAMA_PASSWORD=your_password
```

#### 3. 配置前端

创建 `frontend/.env.local`：

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### 4. 启动数据库和后端

```bash
docker-compose up -d
```

这会启动本地 PostgreSQL + pgvector，以及后端服务。

#### 5. 启动前端

```bash
cd frontend
npm install
npm run dev
```

打开浏览器后注册或登录，就可以开始使用知识工作台。
