# Contributing to PatchCat

Thank you for your interest in contributing to **PatchCat**!  
We welcome all kinds of contributions: bug reports, documentation enhancements, feature proposals, and pull requests.

---

## 🌟 Code of Conduct & Core Philosophy

- **Authenticity First**: We believe in open, genuine learning and engineering transparency.
- **Respect & Inclusivity**: Be welcoming, polite, and constructive during code reviews and issue discussions.

---

## 🛠️ Prerequisites & Tech Stack

- **Node.js**: `v20.0.0` or higher (Recommended: `v22.x`)
- **Package Manager**: `npm`
- **Python**: `3.10` or higher (for the optional FastAPI backend)
- **Frontend Core**: React 19, TypeScript 5.8, XYFlow / React Flow v12, Zustand, Tailwind CSS, Vite
- **Backend Core**: FastAPI, SQLAlchemy 2.0 (Async), SQLite / PostgreSQL (`pgvector`), Pytest

---

## 🚀 Getting Started (Local Development)

### 1. Clone the Repository
```bash
git clone https://github.com/GuoBug/PatchCat.git
cd PatchCat
```

### 2. Frontend Setup
```bash
# Install frontend dependencies
npm install

# Start development server
npm run dev

# Run unit tests (Node.js native test runner)
npm test

# Run TypeScript static type check
npm run typecheck

# Build for production
npm run build
```

### 3. Backend Setup (Optional)
PatchCat operates in **Local Storage mode by default** without needing the backend. If you want to develop server-side features, RAG indexing, or PostgreSQL storage:

```bash
cd server

# Create and activate a virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt

# Run backend test suite
pytest -v tests/

# Start local FastAPI server
uvicorn app.main:app --reload --port 8000
```

---

## 🌿 Branching & Git Commit Convention

We adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat`: A new feature or capability (e.g., `feat(rag): add sliding window chunker`)
- `fix`: A bug fix (e.g., `fix(canvas): prevent handle disconnection in presets`)
- `docs`: Documentation updates or additions (e.g., `docs: update quick-start guide`)
- `test`: Adding or updating test suites (e.g., `test(engine): add DAG cycle detection tests`)
- `refactor`: Code changes that neither fix a bug nor add a feature
- `chore`: Routine maintenance, dependencies, or build tool adjustments

### Branch Naming
- Features: `feat/feature-name`
- Bug fixes: `fix/issue-description`
- Documentation: `docs/topic-name`

---

## 🧪 Pull Request Quality Checklist

Before submitting a Pull Request, please ensure:

1. [ ] **All automated tests pass**:
   ```bash
   npm test
   # If backend files were modified:
   cd server && pytest tests/ && cd ..
   ```
2. [ ] **TypeScript type check passes without errors**:
   ```bash
   npm run typecheck
   ```
3. [ ] **Production build succeeds**:
   ```bash
   npm run build
   ```
4. [ ] Code is well-formatted and descriptive comments are provided for complex logic.
5. [ ] Relevant documentation or ADRs are updated if an architectural decision was made.

---

## 💬 Questions & Community

Feel free to open an [Issue](https://github.com/GuoBug/PatchCat/issues) or submit a [Discussion](https://github.com/GuoBug/PatchCat/discussions) on GitHub. We look forward to collaborating with you!
