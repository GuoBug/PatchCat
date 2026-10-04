# 🐱 PatchCat FastAPI Backend Server

> **Enterprise-grade asynchronous backend service for PatchCat Prompt Orchestrator**  
> Powered by **FastAPI + SQLAlchemy 2.0 (Async) + PostgreSQL (pgvector)**.

---

## 🚀 Quickstart

### 1. Start PostgreSQL + pgvector Database
Make sure Docker Desktop or Docker engine is running on your machine:
```bash
cd server
cp .env.example .env   # then set POSTGRES_PASSWORD (compose refuses to start without it)
docker compose up -d
```
*This starts a PostgreSQL 16 instance on port `5432` with the `pgvector` extension pre-loaded.*

### 2. Setup Python Virtual Environment & Install Dependencies
```bash
cd server
python -m venv venv

# Windows:
.\venv\Scripts\activate

# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Run Development Server
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

> **Security note.** The API is unauthenticated by default and is meant for local use only.
> If you must expose it beyond loopback, set `API_AUTH_TOKEN` in `server/.env` (clients send
> `Authorization: Bearer <token>` or `X-API-Token`). With `APP_ENV=production`, the server
> refuses to start on a non-loopback `HOST` without a token. Rate limiting
> (`RATE_LIMIT_PER_MINUTE`) is in-process per IP; use a reverse proxy for multi-worker setups.
> The bundled web frontend does not send this token yet, so token mode currently suits
> API/CLI clients and a trusted reverse proxy that injects the header.
- **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative ReDoc UI**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

## 🧪 Running Automated Tests

Run the full pytest integration test suite with asynchronous in-memory SQLite:
```bash
pytest -v
```

---

## 📂 Architecture & Directory Structure

```text
server/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── health.py     # System & DB healthcheck
│   │       │   ├── folders.py    # Folders CRUD & category grouping
│   │       │   └── workflows.py  # Workflows CRUD, duplication, move
│   │       └── api.py            # Aggregated APIRouter
│   ├── core/
│   │   ├── config.py             # Pydantic v2 BaseSettings
│   │   └── database.py           # SQLAlchemy 2.0 async engine & sessionmaker
│   ├── models/                   # Database ORM models
│   │   ├── folder.py             # folders table
│   │   └── workflow.py           # workflows table (JSONB nodes/edges)
│   ├── schemas/                  # Pydantic request/response schemas
│   │   ├── folder.py
│   │   └── workflow.py
│   └── main.py                   # FastAPI application entrypoint
├── tests/                        # pytest async test suite
├── docker-compose.yml            # PostgreSQL 16 + pgvector container
├── requirements.txt              # Production & development dependencies
└── .env.example                  # Environment variables template
```
