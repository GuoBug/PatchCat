# PRD-005: 双模存储适配器与 FastAPI 后端集成规范

> **产品需求编号**: PRD-005  
> **模块名称**: Dual-Mode Storage Adapter & FastAPI Backend Integration  
> **文档版本**: 1.0.0  
> **状态**: 已实现 (Implemented & Verified)  
> **最后更新**: 2026-09-02  

---

## 1. 产品背景与业务价值

PatchCat 初始形态为纯前端离线单页应用（BYOK 模式），用户的工作流与密钥均存储在浏览器本地（`localStorage`）。随着产品向**“工业级 AI 编排平台”**演进，以及未来**知识库（RAG）、向量检索与多端团队协同**等高级特性的规划，系统需要既保留“开箱即用、零门槛免部署”的轻量优势，又具备“连接后端数据库、持久化保存与深度 AI 服务”的进阶能力。

### 核心价值主张：
1. **零门槛开箱即用（BYOK 纯前端）**：新用户访问无需搭建后端或安装 Docker，直接在浏览器中编排并调试大模型工作流，数据 100% 本地私密。
2. **平滑升级至后端数据库（FastAPI + DB）**：用户可在系统设置中一键连接自己的本地或远程 FastAPI 后端，实现数据跨设备同步与持久化落盘。
3. **面向未来的 RAG 与知识库底座**：后端基于 **PostgreSQL 16 + pgvector** 构建（本地开发自适应兼容零配置 **SQLite**），为第二阶段的知识库分块检索奠定统一数据契约。

---

## 2. 功能清单与规格说明

### 2.1 双模存储切换矩阵 (Storage Modes)

| 模式 | 存储介质 | 适用场景 | 核心特点 |
| :--- | :--- | :--- | :--- |
| **浏览器本地存储 (Local BYOK)** | 浏览器 `LocalStorage` | 个人即时调试、敏捷验证、零配置运行 | • 零网络依赖<br>• 100% 客户端私密<br>• 开箱即用 |
| **FastAPI 后端服务模式 (Server Mode)** | PostgreSQL + pgvector 或 SQLite (`patchcat.db`) | 团队协作、历史归档、未来向量知识库 | • 结构化持久化存储<br>• JSONB 高性能图结构<br>• 毫秒级 RESTful CRUD API |

---

### 2.2 设置面板交互规范 (`SettingsPage ➔ 常规与语言`)

在系统设置的“常规与语言偏好”页面中，新增 **【存储与后端服务模式 (Storage & Backend Mode)】** 模块：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 💾 存储与后端服务模式 (Storage & Backend Mode)                               │
│ 选择工作流和项目目录的保存位置与同步方式。                                      │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ 🔘 浏览器本地存储 (BYOK 模式)          │ 🔘 FastAPI 后端服务 (PostgreSQL/DB)  │
│ 工作流完全保存在浏览器 LocalStorage 中，   │ 持久化存储至 FastAPI 后端数据库，支持多端  │
│ 无需后端数据库，零配置且完全私密。       │ 数据同步与知识库向量检索。 [✔ 当前选中]│
├──────────────────────────────────────┴──────────────────────────────────────┤
│ 后端服务地址 (API Base URL)                                                  │
│ [ http://localhost:8000                          ] [ ⚡ 测试后端连接 ]      │
│                                                                             │
│ [✔ 后端已连接: Connected (PatchCat Backend v0.1.0) - DB: Connected ]   3ms  │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **单选切换卡片**：
   - 切换为“浏览器本地存储”时，工作流读取与变更重定向至 LocalStorage。
   - 切换为“FastAPI 后端服务”时，系统展开后端配置输入区并自动触发一次连通性探测。
2. **后端服务地址配置**：
   - 支持自定义 `API Base URL`（默认 `http://localhost:8000`）。
3. **实时连通性探测按钮 (Test Connection)**：
   - 发送 `GET /api/v1/health` 请求，探测后端 API 可达性及数据库连接池状态。
   - 界面实时展示后端版本号、数据库连接状态（`Connected` / `Degraded`）以及**毫秒级网络往返耗时（如 `3ms`）**。
4. **平滑冷启动与空库自动种子初始化 (Auto-Seed)**：
   - 首次接入空白数据库时，前端自动将默认目录（`Default`、`Official Presets`）及官方预设工作流初始化写入后端，避免初次连接出现白屏或空列表。

---

## 3. 技术架构与数据流契约

### 3.1 前端存储抽象层 (`IStorageAdapter`)

前端采用**适配器设计模式 (Adapter Pattern)**，隔离上层状态机（`useProjectStore`）与底层持久化细节：

```mermaid
flowchart TD
    UI[Workflow UI / Left Sidebar] --> Store[useProjectStore]
    Store --> Factory[getStorageAdapter]
    
    subgraph Storage Adapters
        Factory -->|mode = 'local'| Local[LocalStorageAdapter]
        Factory -->|mode = 'server'| Server[ApiServerAdapter]
    end
    
    Local --> Browser[(Browser LocalStorage)]
    Server -->|REST HTTP| FastAPI[FastAPI Backend /api/v1]
    FastAPI --> DB[(SQLite / PostgreSQL + pgvector)]
```

#### 接口定义清单 (`src/services/storage/storage-adapter.ts`)：
- **目录接口**：`getFolders()`, `createFolder()`, `updateFolder()`, `deleteFolder()`
- **工作流接口**：`getWorkflows()`, `getWorkflow(id)`, `createWorkflow()`, `saveWorkflow()`, `duplicateWorkflow()`, `moveWorkflow()`, `deleteWorkflow()`

---

### 3.2 后端 RESTful API 接口规范

后端基于 **FastAPI + SQLAlchemy 2.0 (Async) + Pydantic v2** 构建，统一前缀为 `/api/v1`：

| Method | Endpoint | 说明 | Payload / Query |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | 服务健康检查与 DB 连通性探测 | 返回 `status`, `app_name`, `version`, `database_connected` |
| `GET` | `/api/v1/folders` | 获取目录层级列表 | 无 |
| `POST` | `/api/v1/folders` | 创建新目录 | `{ name: string, is_expanded: bool }` |
| `PUT` | `/api/v1/folders/{id}` | 更新/重命名目录 | `{ name?: string, is_expanded?: bool }` |
| `DELETE` | `/api/v1/folders/{id}` | 删除目录（内部流程归入默认目录） | 无 |
| `GET` | `/api/v1/workflows` | 获取工作流列表（可按目录/搜索过滤） | `?folder_id=...&search=...` |
| `POST` | `/api/v1/workflows` | 创建新工作流 | 完整工作流图结构（`nodes`, `edges`, `global_inputs`） |
| `GET` | `/api/v1/workflows/{id}` | 获取工作流全图详情 | 无 |
| `PUT` | `/api/v1/workflows/{id}` | 更新工作流（自动保存/重命名） | `{ name?, folder_id?, nodes?, edges?, global_inputs? }` |
| `POST` | `/api/v1/workflows/{id}/duplicate` | 克隆工作流副本 | 无 |
| `POST` | `/api/v1/workflows/{id}/move` | 移动工作流至指定目录 | `{ target_folder_id: string }` |
| `DELETE` | `/api/v1/workflows/{id}` | 删除指定工作流 | 无 |

---

## 4. 数据库引擎自适应机制 (Zero-Docker Support)

为降低开发与上手门槛，后端数据库引擎具备环境感知能力：
1. **默认模式（Zero-Setup Local SQLite）**：
   - 默认配置：`DATABASE_URL="sqlite+aiosqlite:///./patchcat.db"`
   - 自动在 `server/` 目录下生成嵌入式数据库文件，无需安装 Docker 或独立数据库服务。
2. **生产/容器模式（PostgreSQL 16 + pgvector）**：
   - 配置：`DATABASE_URL="postgresql+asyncpg://patchcat:patchcat_secret@localhost:5432/patchcat_db"`
   - 支持高并发连接池 (`pool_size=10, max_overflow=20`) 与向量检索扩展，配合 `server/docker-compose.yml` 一键启动。

---

## 5. 质量与验收标准

1. **功能完整性**：
   - 用户在前端创建、重命名、移动、删除目录和工作流，能即时在前端生效，并在后端数据库中精准落盘。
2. **异常韧性 (Fault Tolerance)**：
   - 当后端离线或网络断开时，前端自动降级为本地缓存提示，不阻断画布的核心编辑与离线调试能力。
3. **测试覆盖**：
   - 前端单元测试 62/62 全部通过（涵盖 LocalStorage 读写、存储模式切换、健康测试 Mock 与状态机流转）。
   - 后端 Pytest 自动化测试全部通过。
