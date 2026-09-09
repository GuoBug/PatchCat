# 贡献指南 (Contributing to PatchCat)

感谢您对 **PatchCat** 的关注与支持！  
我们欢迎一切形式的贡献：Bug 报告、文档改进、功能提案和代码 Pull Request。

> 📖 **English Version**: [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 🌟 行为准则与核心理念

- **真实坦诚**：我们倡导开放、真实的学习态度与工程透明度。PatchCat 项目全程借助 AI 辅助编程和「干中学」的方式落地，欢迎社区同行一起交流探讨。
- **尊重包容**：在代码评审和 Issue 讨论中，请保持友善、礼貌和建设性。

---

## 🛠️ 开发环境要求

- **Node.js**: `v20.0.0` 或更高（推荐 `v22.x`）
- **包管理器**: `npm`
- **Python**: `3.10` 或更高（仅用于可选的 FastAPI 后端）
- **前端技术栈**: React 19、TypeScript 5.8、XYFlow / React Flow v12、Zustand、Tailwind CSS、Vite
- **后端技术栈**: FastAPI、SQLAlchemy 2.0 (Async)、SQLite / PostgreSQL (`pgvector`)、Pytest

---

## 🚀 快速上手（本地开发）

### 1. 克隆仓库
```bash
git clone https://github.com/GuoBug/PatchCat.git
cd PatchCat
```

### 2. 前端启动
```bash
# 安装前端依赖
npm install

# 启动开发服务器
npm run dev

# 运行单元测试（Node.js 原生测试运行器）
npm test

# TypeScript 静态类型检查
npm run typecheck

# 生产环境构建
npm run build
```

### 3. 后端启动（可选）
PatchCat 默认以 **本地存储模式** 运行，无需后端。如果你需要开发服务端功能、RAG 索引或 PostgreSQL 存储：

```bash
cd server

# 创建并激活虚拟环境
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# 安装后端依赖
pip install -r requirements.txt

# 运行后端测试套件
pytest -v tests/

# 启动本地 FastAPI 服务器
uvicorn app.main:app --reload --port 8000
```

---

## 🌿 分支规范与 Git 提交约定

我们遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范：

- `feat`: 新功能或能力（如 `feat(rag): add sliding window chunker`）
- `fix`: Bug 修复（如 `fix(canvas): prevent handle disconnection in presets`）
- `docs`: 文档更新或新增（如 `docs: update quick-start guide`）
- `test`: 新增或更新测试（如 `test(engine): add DAG cycle detection tests`）
- `refactor`: 既不修复 Bug 也不新增功能的代码重构
- `chore`: 日常维护、依赖更新或构建工具调整

### 分支命名规范
- 功能分支: `feat/feature-name`
- Bug 修复: `fix/issue-description`
- 文档更新: `docs/topic-name`

---

## 🧪 Pull Request 质量检查清单

提交 Pull Request 前，请确保：

1. [ ] **所有自动化测试通过**：
   ```bash
   npm test
   # 如果修改了后端代码：
   cd server && pytest tests/ && cd ..
   ```
2. [ ] **TypeScript 类型检查无错误**：
   ```bash
   npm run typecheck
   ```
3. [ ] **生产构建成功**：
   ```bash
   npm run build
   ```
4. [ ] 代码格式规范，复杂逻辑附有描述性注释。
5. [ ] 如果涉及架构决策，请同步更新相关文档或 ADR。

---

## 📁 项目目录结构

```
PatchCat/
├── src/                    # 前端源码
│   ├── components/         # React 组件（nodes、panels、canvas）
│   ├── engine/             # DAG 调度引擎、LLM 客户端、沙箱执行器
│   ├── stores/             # Zustand 状态管理
│   ├── services/           # 文档解析器、存储适配器
│   ├── presets/            # 内置工作流模板
│   ├── i18n/               # 国际化翻译
│   └── config/             # 应用配置
├── server/                 # FastAPI 后端（可选）
│   ├── app/api/            # REST API 路由
│   ├── app/models/         # SQLAlchemy ORM 模型
│   ├── app/services/       # 业务逻辑服务
│   └── tests/              # 后端测试
├── tests/                  # 前端单元测试
├── docs/                   # 项目文档
│   ├── 01-prd/             # 产品需求文档
│   ├── 02-architecture/    # 架构设计文档
│   ├── 03-api/             # API 接口契约
│   └── 04-dev-notes/       # 开发笔记与 ADR
└── public/                 # 静态资源
```

---

## 💬 社区交流

欢迎通过以下方式参与社区：
- 🐛 发现 Bug？[提交 Issue](https://github.com/GuoBug/PatchCat/issues)
- 💡 有功能建议？[发起 Discussion](https://github.com/GuoBug/PatchCat/discussions)
- 🚀 想贡献代码？Fork 仓库并提交 Pull Request

我们期待与你一起共建 PatchCat！
