# 开发日志：Phase 1 - 抽屉式多流程管理与双模存储架构

> **开发周期**: 2026-09-02 (下午)  
> **协作者**: Guo Qiang (GuoBug) & Antigravity (AI Pair Programming)  
> **阶段定位**: 存储解耦与工作流多目录管理 (Drawer Management & Dual-Mode Storage)  
> **关联 PRD**:  
> - [PRD-004: Workflow Project & Hierarchical Directory Management](../01-prd/PRD-004-Workflow-Project-Directory-Management.md)  
> - [PRD-005: Dual-Mode Storage Adapter & FastAPI Backend Integration](../01-prd/PRD-005-Dual-Mode-Storage-and-FastAPI-Backend.md)  
> - [Phase 1: FastAPI + PostgreSQL 后端架构与双模存储设计](../02-architecture/phase-1-backend-and-dual-storage-architecture.md)  

---

## 1. 业务痛点与架构诉求

当 PatchCat 的核心编排能力完备后，我们迎来了真实业务场景的瓶颈：
- **单画布承载极限**：一个画布无法容纳所有业务流程（如“智能客服分流”、“多 Agent 辩论仲裁”、“长文总结”），混在同一张图上会导致严重的视觉认知过载；
- **纯前端持久化的脆弱性**：早期所有工作流存在浏览器的 LocalStorage 中，一旦清除浏览器缓存或更换电脑，工作流全部丢失；
- **团队协作与服务端扩展**：未来需要服务端集中存储工作流，并在后端执行重型计算与向量检索，但**绝不能强迫所有普通用户必须启动后端 Docker**。

---

## 2. 关键节点双向共创 (Milestone Co-Discovery)

| 关键决策节点 | 人类提出（产品定位与业务痛点） | AI 提出（底层工程规约与系统隐患） |
| :--- | :--- | :--- |
| **抽屉式可视化管理** | 在左侧设计一个优雅的抽屉式侧边栏，支持按业务目录分类管理多个工作流，支持一键切换、重命名、复制与删除。 | 提出**乐观更新（Optimistic UI）+ 状态机分层解耦架构**：UI 操作必须在 0 延迟响应（60fps），由底层状态机异步负责与存储同步。 |
| **存储介质彻底解耦** | 用户既可以免后端纯本地用，也可以连自己的团队后端数据库用，界面操作逻辑必须 100% 一致。 | 提出引入 **`StorageAdapter`（适配器设计模式）**，如同电子设备的 Type-C 接口协议，上层仅面向 `IStorageAdapter` 契约编程，彻底隔离底层存储介质。 |
| **后端数据库双模自适应** | 后端服务要支持 SQLite 单文件即开即用，也要支持生产环境 PostgreSQL + pgvector。 | 指出 SQLite 与 PostgreSQL 在 JSON 字段和连接池参数上的差异，在 SQLAlchemy 2.0 中采用 `JSONB().with_variant(JSON(), "sqlite")` 抹平差异。 |
| **空库自愈与种子初始化** | 当用户第一次连上全新的空后端数据库时，不能显示一片空白，要有默认示例。 | 设计 **自动种子注入逻辑 (Auto-Seed)**：当后端检测到没有任何目录与工作流时，自动注入预设模版，保证开箱即用。 |

---

## 3. 核心功能落地实现

### 3.1 抽象存储适配契约 (`src/services/storage/storage-adapter.ts`)
- 定义强类型 `IStorageAdapter` 接口，涵盖目录与工作流的全部 CRUD 契约；
- 实现 `LocalStorageAdapter`：纯离线浏览器本地存储；
- 实现 `ApiServerAdapter`：异步请求 FastAPI RESTful 接口；
- 导出 `getStorageAdapter(mode, baseUrl)` 工厂方法。

### 3.2 抽屉式工作流管理状态机 (`src/stores/project-store.ts`)
- 基于 Zustand + Immer 管理目录树（`Folder`）与工作流集合（`Workflow`）；
- 支持多目录展开/折叠、新建目录、工作流跨目录自由移动（`moveWorkflow`）与克隆（`duplicateWorkflow`）；
- 乐观更新机制：本地状态先行变更，异步背景向存储端发起持久化同步，失败时优雅告警。

### 3.3 异步服务端底座构建 (`server/`)
- 基于 **FastAPI + SQLAlchemy 2.0 Async + aiosqlite / asyncpg**；
- 编写 `FolderORM` 与 `WorkflowORM`，建立 `1:N` 外键级联约束；
- 提供 `/api/v1/health`、`/api/v1/folders`、`/api/v1/workflows` 完整 REST 接口群。

### 3.4 设置页双模切换与实时连通性探测 (`src/components/panels/SettingsPage.tsx`)
- 在设置页面提供【存储与后端模式】配置卡片；
- 支持在“纯本地存储 (Local Browser)”与“服务端持久化 (FastAPI Server)”之间一键切换；
- 提供实时【测试连通性】按钮：向服务端发送健康检查并实时回显真实毫秒级网络时延（Ping Latency）。

---

## 4. 自动化测试与质量保障
- 编写 `tests/project-store.node.test.ts`：验证目录增删改、工作流复制、跨目录移动与 StorageAdapter 同步；
- 编写 `server/tests/test_api.py`：使用 pytest-asyncio 验证健康检查、目录 CRUD、工作流持久化与级联删除；
- 前后端双测试套件全部通过，为第二阶段的知识库接入打下了坚如磐石的底座。
