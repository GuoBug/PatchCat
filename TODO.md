# PatchCat 待办清单与研发路线图 (TODO & Roadmap)

> **当前版本**: `v0.1.0` (即刻跃升至 `v0.2.0`)  
> **更新时间**: 2026-09-03  
> **维护人**: Guo Qiang (GuoBug) & Antigravity  

---

## 🚀 下次迭代优先目标：正式发版 `v0.2.0` (Next Release: v0.2.0 Milestone)

本阶段核心任务是完成 **v0.2.0 的“临门一脚”预设闭环**，并正式升级版本号，同步补齐开源发版治理文档：

- [ ] **1. 内置【RAG 知识库增强问答】开箱即用预设模板**
  - [ ] 在 `src/presets/index.ts` 中新增 `rag-qa` 预设数据：
    - 拓扑结构：`Input (用户提问)` ➔ `Knowledge (知识库召回)` ➔ `Prompt (引文组装)` ➔ `LLM (模型解答)` ➔ `Output (答案输出)`；
    - 配备标准的变量插值与默认配置；
  - [ ] 在 `ControlHeader.tsx` 的预设下拉菜单中注册并提供中英双语标签与描述；
  - [ ] 增加预设加载与执行的自动化集成测试。

- [ ] **2. 正式跃升版本号至 `v0.2.0` (Version Bump)**
  - [ ] 将 `package.json` 中的 `"version"` 由 `0.1.0` 提升至 `0.2.0`；
  - [ ] 将 `src/components/panels/ControlHeader.tsx` 中的顶栏版本徽章更新为 `v0.2`；
  - [ ] 更新 `README.md` 与 `README_CN.md` 中的版本展示徽标。

- [ ] **3. 补齐规范化版本发布与开源治理文档**
  - [ ] 创建根目录 **`CHANGELOG.md`**：
    - 遵循 *Keep a Changelog* 与 *SemVer* 国际规范；
    - 详细列清 `v0.1.0`（原型奠基）与 `v0.2.0`（后端底座、双模存储、多流程管理、RAG 向量体系）的全部 `Added`、`Changed` 与 `Fixed`。
  - [ ] 创建根目录 **`CONTRIBUTING.md`**：
    - 制定环境搭建步骤（Node 22 / Python 3.10）；
    - 制定分支开发与 Commit Message 规范（Conventional Commits）；
    - 制定前端 `npm test` 与后端 `pytest` 提测准入要求。

- [ ] **4. 验收与 Git Release Tag 打标**
  - [ ] 全量 76+ 项前后端测试 100% 绿灯验收；
  - [ ] `npm run build` 生产打包验证；
  - [ ] 执行 `git tag -a v0.2.0 -m "Release v0.2.0: Backend Architecture, Multi-Workflow Drawer & Complete RAG Pipeline"`。

---

## 🔮 中长期研发路线图 (Future Roadmap)

### Phase 2.5: 知识库体验增强 (Knowledge UX Polish)
- [ ] 前端知识库管理可视化抽屉/页面（支持查看文档切片列表、切片命中计数、停用/启用单条切片）；
- [ ] 本地富文本文件解析器（支持上传 `.pdf`、`.docx`、`.markdown` 并自动抽取文本）；
- [ ] 混合检索（Hybrid Search: 向量稠密检索 + BM25 关键词检索加权合并）。

### Phase 3: 多 Agent 协作与条件分支编排 (Condition & Multi-Agent)
- [ ] 条件分支与逻辑判断节点 (`if-else` / `router`)；
- [ ] 子工作流嵌套调用节点 (`sub-workflow`)；
- [ ] 实时流式协作 Agent 节点（多角色辩论与投票机制）。

### Phase 4: 团队协作与生产交付 (Production & Team Collaboration)
- [ ] 编写 `docker-compose.yml` 与私有化部署运维指南；
- [ ] 编写数据库物理表字典与 Alembic 迁移脚本；
- [ ] 工作流权限控制与多人协作分享链接。

---

## ✅ 已完成的历史里程碑 (Completed Milestones)

- [x] **Phase 0: 核心拓扑调度引擎与可视化画布构建 (2026-08-28 ~ 08-31)**
  - [x] 基于 Kahn 算法的 DAG 波次调度引擎与循环死锁检测；
  - [x] 防原型链污染的变量解析器；
  - [x] React Flow 12 极简暗黑画布与 5 大基础节点；
  - [x] 4 项极限混沌基准测试与 6 节点电商仲裁场景测试。
- [x] **Phase 0.5: 多模型生态适配、脱敏日志与全屏设置 (2026-09-01 ~ 09-02 上午)**
  - [x] Google Gemini 端点自适应抹平与 DeepSeek R1 思考流 (SSE) 解析；
  - [x] 三层脱敏日志引擎 (Summary/Detailed/Dev) 与防御循环嵌套深层掩码；
  - [x] 全屏独立设置中心 (`SettingsPage`) 与零依赖强类型中英双语国际化；
  - [x] 未配置 Key 前置预检与流程仿真验证 (Dry-Run)。
- [x] **Phase 1: 抽屉式多流程管理与双模存储架构 (2026-09-02 下午)**
  - [x] 抽屉式目录树管理、多工作流分类 CRUD、复制与跨目录移动；
  - [x] `StorageAdapter` 契约抽象（LocalStorage vs REST API）；
  - [x] FastAPI + SQLAlchemy 2.0 异步服务端底座 (SQLite / PostgreSQL 自适应)；
  - [x] 设置页后端连通性实时 Ping 测速与空库自动种子 (auto-seed)。
- [x] **Phase 2: RAG 知识库体系与画布节点全链路闭环 (2026-09-03)**
  - [x] Dify 级经典三层数据建模 (`KB` ➔ `Document` ➔ `Chunk`)；
  - [x] ETL 文本清洗规约与带 Overlap 50 字符的滑动窗口分块器；
  - [x] 统一 Embedding 客户端与确定性离线特征向量生成器；
  - [x] 余弦相似度 Top-K 语义召回与切片 `hit_count` 热度遥测；
  - [x] 原生青蓝【知识库检索节点】、属性面板变量绑定与 4 节点完整 RAG 闭环。
