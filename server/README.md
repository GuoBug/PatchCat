# 🐱 PatchCat FastAPI Backend Server

> **Enterprise-grade asynchronous backend service for PatchCat Prompt Orchestrator**  
> Powered by **FastAPI + SQLAlchemy 2.0 (Async) + PostgreSQL (pgvector)**.

---

## 🚀 Quickstart

### 1. Start PostgreSQL + pgvector Database
Make sure Docker Desktop or Docker engine is running on your machine:
```bash
cd server
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
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
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
