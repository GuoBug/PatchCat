# PRD-020: MemoryNode 画布记忆原语与工作流版本快照

> **状态**：待评审 (Ready for Review)  
> **版本**：1.0.0 (Part A 交付验收 + Part B 生产级契约详述版)  
> **负责人**：Guo Qiang (GuoBug)  
> **最后更新**：2026-10-15  
> **关联文档**：[PRD-010: 会话记忆与存储架构](PRD-010-Conversation-Memory-and-Storage-Architecture.md)、[PRD-016: 不可变快照与断点续跑](PRD-016-Immutable-Checkpointing-and-Resumable-DAG-Execution.md)、[PRD-017: 端侧数据主权与加密暗室](PRD-017-Local-Data-Sovereignty-and-Storage-Hardening.md)  
> **源码对齐**：`src/services/storage/indexeddb-adapter.ts`、`src/services/diff/workflow-diff.ts`、`src/services/export/workflow-sanitizer.ts`、`src/engine/history-manager.ts`、`src/stores/workflow-store.ts`

---

## 0. 范围裁剪与交付路线

| # | 交付项 | 范围 | 当前状态 | 交付规划 |
| :--- | :--- | :--- | :--- | :--- |
| A | `MemoryNode` 画布原语 | 只读三通道会话数据源、防双写防续跑污染、无会话平滑降级 | **已全量交付 ✅** | 574 项自动化测试全绿 |
| B | 工作流版本快照 + 结构化 Diff + 回滚 | IndexedDB v7、30个版本配额、结构化语义 Diff、布局噪声折叠、原子回滚与 Ctrl+Z | **本阶段核心交付 🎯** | 本 PRD 冻结生产级契约 |
| C | `.patchcat` 单文件归档包 | 包含工作流版本与本地知识库导出的便携绿色包 | 延后 | 依赖 B 的版本格式稳定后独立立项 |
| D | 跨工作流记忆联邦 | 跨画布会话共享长程记忆池 | 延后 | 需先沉淀 A 的作用域运行数据 |

---

## 1. 现状核验

### 1.1 现状与痛点：版本管理缺失的四重隐患
1. **试错成本高，刷新即丢失**：当前画布仅依赖 `src/engine/history-manager.ts` 提供 25 步纯内存撤销栈，页面一旦刷新或误操作关闭，所有微调历史彻底灰飞烟灭；
2. **盲目覆盖风险**：用户在测试新 Prompt 或尝试新节点拓扑时，缺乏持久化保存里程碑的手段；如果改乱了只能凭记忆手动复原，缺乏原子回滚能力；
3. **文本 JSON Diff 的致命噪声**：如果直接做纯文本 JSON 比对，因节点拖拽产生的坐标微小位移（`position: { x, y }`）会产生大量虚假 Diff，导致关键的提示词修改、参数变动和连线增删被淹没；
4. **运行态与凭证污染隐患**：如果简单将画布全状态存为快照，执行输出（大文本、大 JSON）会导致 IndexedDB 迅速膨胀，更会导致明文 API Key 泄漏至历史快照中，违背 PRD-017 确立的数据主权零明文红线。

### 1.2 架构分工澄清：Version Snapshot vs Checkpoint
系统内存在两套容易混淆的“快照”机制，在此做绝对边界划分：

| 机制 | 存储仓库 | 记录内容 | 淘汰策略 | 触发时机 | 核心用途 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DAG Checkpoint** (PRD-016) | `checkpoints` | 节点运行时**输出数据** (`outputs`) | FIFO 环形淘汰 (上限 5 个) | 每次运行自动记录 | 断点续跑与就地重试，节省模型调用 |
| **Workflow Version** (本 PRD) | `workflow_versions` | 纯净**逻辑拓扑与配置** (剥离运行态与 Key) | **满额 30 个拒绝新建** (不静默淘汰) | **用户手动命名触发** | 演进历史追溯、版本 Diff 与安全回滚 |

---

## 2. Part A：MemoryNode（已全量交付 ✅）

> 详见源码 `src/engine/nodes/memory.ts` 与单测 `tests/memory-node.node.test.ts`。  
> 核心交付点：
> 1. 只读数据源节点定位，面板保持唯一写入方，根除双写竞争与模拟运行污染；
> 2. 滚动摘要 (`chat_summary`)、近期逐字窗口 (`chat_history`)、置顶消息 (`isPinned`) 三通道独立输出；
> 3. L4 Never-Throw 契约：画布顶部直接执行无会话时安全输出 `meta.session_status = 'no_session'`，绝不阻断下游；
> 4. 断点续跑 non-cacheable 规约与子工作流作用域强隔离。

---

## 3. Part B：工作流版本快照与结构化 Diff 引擎（生产级规约）

### 3.1 底座存储契约：IndexedDB v7 `workflow_versions`

#### 3.1.1 数据库结构升级
IndexedDB 升级至 `DB_VERSION = 7`，新增 `workflow_versions` 专用对象仓库：
- `keyPath`: `id` (UUID v4)
- `indexes`:
  - `by_workflow`: `workflowId` (按工作流分组索引)
  - `by_created_at`: `createdAt` (时间序索引)

#### 3.1.2 版本数据结构定义
```typescript
export interface WorkflowVersion {
  id: string;               // 唯一版本 ID (UUID v4)
  workflowId: string;       // 所属工作流 ID (外键关联)
  label: string;            // 用户版本标签 (如 "v1.2 优化质检 Prompt")
  description?: string;     // 可选说明文本
  createdAt: number;        // 创建时间戳
  graph: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    globalInputs?: Record<string, unknown>;
    memoryConfig?: WorkflowMemoryConfig;
  };
  graphHash: string;        // 规范化逻辑拓扑 SHA-256 哈希值 (64位 Hex)
  metadata: {
    nodeCount: number;
    edgeCount: number;
    sanitized: boolean;     // 显式标记脱敏与运行态剥离完成
  };
}
```

#### 3.1.3 存储脱敏与数据纯粹性防线 (Sanitization Pipeline)
快照入库前**强制执行清洗流水线**（基于 `src/services/export/workflow-sanitizer.ts`）：
1. **剥离运行态 (`clearExecutionOutputs: true`)**：清空所有节点的 `data.outputs`、执行错误、遥测 SpanID 及画布运行时高亮，确保仅持久化纯逻辑图元，IndexedDB 单版本体积从数十 KB 压减至 < 3 KB；
2. **零明文红线 (`stripApiKeys: true`)**：递归剥离各节点配置（如 LLMNodeProviderOverride、HttpNode headers/authConfig、KnowledgeNode embedding/rerank）、全局输入及凭据字段中的所有 API Key；并通过 `isGraphFullySanitized` 进行入库前严格白盒校验，驱动 `metadata.sanitized` 状态位；
3. **快照保真回滚设计 (`maskSensitivePromptVars: false` / `stripLocalPaths: false`)**：与对外导出分享场景不同，版本快照服务于本地工作流的安全无损回滚。为保证用户回滚后 Prompt 中的变量结构与知识库本地挂载路径（如 `localPath`）100% 完整可用，此处不中和本地路径与提示词模板中的变量，仅对敏感凭据与执行态实施阻断清洗。

#### 3.1.4 配额控制与防静默丢弃契约 (Quota Governance)
- **单流程硬配额**：单个工作流最多持久化 **30 个版本快照**；
- **满额处理原则**：达到 30 个上限时，**坚决拒绝新增保存并向用户弹出明确指引**（提示“快照数量已达 30 个上限，请在版本列表中删除无用快照后继续”）。
- **红线**：**严禁使用 FIFO 自动淘汰用户命名的快照**。用户手动打标的版本承载着不可逆的业务演进意图，静默删除可能导致核心业务拓扑永久丢失。

---

### 3.2 规范化拓扑指纹算法 (Canonical Graph Hash)

为实现版本快速去重、脏状态感知（当前画布是否有未保存修改）与回滚安全预检，必须构建**与布局顺序无关的规范化哈希算法**：

```typescript
export function computeCanonicalGraphHash(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  globalInputs?: Record<string, unknown>,
  memoryConfig?: WorkflowMemoryConfig,
): string;
```

#### 规范化规则：
1. **节点逻辑归一化**：
   - 提取逻辑字段：`id`、`type`、`data.label`、`data.config`；
   - **剔除坐标与瞬态**：显式排除 `position`、`selected`、`dragging`、`data.outputs`；
   - 节点数组按 `node.id` 字典序升序稳定排序；
2. **连线逻辑归一化**：
   - 提取逻辑复合键：`${edge.source}:${edge.sourceHandle ?? ''}->${edge.target}:${edge.targetHandle ?? ''}`；
   - 连线数组按复合键字典序升序排序；
3. **全局参数规范化**：
   - `globalInputs` 键字典序排序；`memoryConfig` 核心字段归一化；
4. **哈希计算**：
   - 通过稳定 JSON 序列化（`canonicalStringify`）输出确定性字符串；
   - 调用 Web Crypto API `crypto.subtle.digest('SHA-256', utf8Bytes)` 生成 64 位 16 进制 Hash。

#### 应用场景：
- **无意义保存拦截**：保存快照时比对最新版本的 `graphHash`，若一致则阻断并提示“当前画布拓扑与最新快照完全一致，无需重复创建”；
- **脏改动感知**：当前画布的 `graphHash` 若不等于任何已保存快照的 `graphHash`，标记为 `isDirty: true`。

---

### 3.3 纯前端结构化语义 Diff 引擎 (`workflow-diff.ts`)

摒弃纯文本行级比对，针对 DAG 图论结构设计专门的结构化 Diff 引擎：

```typescript
export interface NodePropertyDiff {
  path: string;           // 变更路径，如 "config.temperature"
  oldValue: unknown;
  newValue: unknown;
}

export interface NodeDiff {
  nodeId: string;
  nodeType: string;
  label: string;
  status: 'added' | 'deleted' | 'modified' | 'unchanged';
  changes?: NodePropertyDiff[];
  isLayoutOnly?: boolean; // 关键：仅坐标发生位移，逻辑完全不变
  positionDelta?: { dx: number; dy: number };
}

export interface EdgeDiff {
  edgeKey: string;        // source:sourceHandle->target:targetHandle
  source: string;
  target: string;
  status: 'added' | 'deleted' | 'unchanged';
}

export interface WorkflowDiffResult {
  hasChanges: boolean;
  hasLogicalChanges: boolean; // 是否存在真实的业务逻辑差异（排除仅坐标拖拽）
  nodes: {
    added: WorkflowNode[];
    deleted: WorkflowNode[];
    modified: NodeDiff[];
    layoutOnly: NodeDiff[];   // 独立分组，供 UI 默认折叠
  };
  edges: {
    added: WorkflowEdge[];
    deleted: WorkflowEdge[];
  };
  globals: {
    inputsChanged: boolean;
    memoryChanged: boolean;
    changes: Array<{ key: string; oldValue: unknown; newValue: unknown }>;
  };
  stats: {
    addedNodeCount: number;
    deletedNodeCount: number;
    modifiedNodeCount: number;
    layoutNodeCount: number;
    addedEdgeCount: number;
    deletedEdgeCount: number;
  };
}
```

#### 核心比对判据：
1. **节点比对**：
   - Target 有、Source 无 $\to$ `added`；
   - Source 有、Target 无 $\to$ `deleted`；
   - 双方均有：
     - 若 `type`、`data.label`、`data.config` 深比较完全一致，但 `position` 发生变化 $\to$ 归类为 **`layoutOnly` 仅布局变更**；
     - 若 `data.config` 或核心逻辑字段变化 $\to$ 深度遍历递归生成 `changes` 路径清单，归类为 `modified`；
2. **连线比对**：
   - 以 `${source}:${sourceHandle ?? ''}->${target}:${targetHandle ?? ''}` 为唯一逻辑连线标识进行差集计算，生成 `added` 与 `deleted`；
3. **Prompt 与 Code 文本深度比对**：
   - 对 `PromptNode.config.template` 及 `CodeNode.config.code`，提供行级文本差异分析（LCS 算法），支持在详情抽屉中展开红绿行级 diff；
4. **工效降噪保障**：
   - `hasLogicalChanges` 仅在存在节点增删、逻辑属性修改或连线增删时为 `true`。若用户只是整理了画布拖动了节点位置，`hasLogicalChanges = false`，UI 给予低对比度弱提示并默认折叠布局组，彻底解放审查认知负荷。

---

### 3.4 原子回滚与撤销状态机 (Rollback State Machine)

回滚是高风险破坏性操作，必须具备严格的原子事务保护与二次确认：

```
[用户触发回滚至版本 V_target]
             │
             ▼
   【当前画布脏状态检查】
   currentGraphHash === latestVersionHash ?
    ├── 是 ──► [直接进入安全回滚流水线]
    └── 否 ──► [弹出防丢失预警模态框]
                 ├─ 选项 1: 先保存当前改动为新版本，再回滚
                 ├─ 选项 2: 放弃当前改动，直接覆盖回滚
                 └─ 选项 3: 取消操作
             │
             ▼
   【原子压入本地撤销栈】
   historyManager.pushSnapshot({
     nodes: currentNodes,
     edges: currentEdges,
     action: 'ROLLBACK_RESTORE'
   })  <── 赋予用户 Ctrl+Z 瞬时撤销回滚的终极悔棋能力！
             │
             ▼
   【状态机就地覆盖装载】
   workflowStore.loadGraphSnapshot(V_target.graph)
   workflowStore.resetExecutionStates() // 清理旧 outputs 与高亮
             │
             ▼
   【持久化当前工作流 Payload】
   indexedDbAdapter.put(WORKFLOWS_PAYLOAD, { id: wfId, ...V_target.graph })
```

---

### 3.5 界面交互与工效体验契约

1. **画布控制台入口 (`ControlHeader.tsx`)**：
   - 新增 `[⏱️ 快照]` 操作按钮，附带当前已存版本数量徽章（如 `3/30`）；
   - 右侧集成快捷保存按钮 `[💾 存为快照]`，支持快捷键 `Ctrl+Shift+S`；
2. **版本管理与历史追溯抽屉 (`WorkflowVersionDrawer.tsx`)**：
   - 呼出右侧抽屉，垂直时间线展示历史快照列表；
   - 单卡片信息：自定义 Label、相对保存时间（如“10 分钟前”）、节点数/连线数胶囊；
   - 单卡片动作：`[🔍 比对当前]`、`[↺ 回滚]`、`[🗑️ 删除]`；
3. **结构化差异审查弹窗 (`WorkflowDiffModal.tsx`)**：
   - 双栏/分栏视图：左侧展示快照版本，右侧展示当前画布（或指定两版本比对）；
   - 顶部指标看板：`+2 节点`、`-1 节点`、`~3 修改`、`5 处仅排版位移(已折叠)`；
   - 交互列表：点击任意变更节点，右侧弹出属性差异面板，直观显示如 `temperature: 0.7 ➔ 0.2`；
4. **新建快照弹窗 (`CreateVersionModal.tsx`)**：
   - 输入版本标签（默认贴心占位符，如 `v{next_index} - 优化提示词`）及可选描述；
   - 自动检测并显示变更摘要预览；若已达 30 个上限，保存按钮禁用并呈现清理入口。

---

## 4. 验收标准与测试矩阵 (Test Matrix)

### 4.1 Part A（已全量通过 ✅）
- [x] `tests/memory-node.node.test.ts` 21 项测试通过；
- [x] 无会话时输出空值与 `no_session`，绝不阻塞下游；
- [x] 断点续跑与子工作流边界隔离符合规约。

### 4.2 Part B（本阶段交付验收准则）
- [ ] **存储升级与向后兼容 (`tests/workflow-version-snapshots.node.test.ts`)**：
  - IndexedDB 从 v6 平滑幂等升至 v7，`workflows_payload`、`vector_embeddings`、`secure_vault` 等原有仓库数据 100% 完好；
  - 成功写入、查询、按工作流列出与删除 `workflow_versions` 记录；
- [ ] **配额与安全隔离**：
  - 单流程写入第 31 个快照时，严格拦截并抛出受控配额错误，原有 30 条记录完整保留（零静默丢弃）；
  - 校验入库快照对象：`outputs` 字段为 undefined、所有 `apiKey` 字段被彻底剔除；
- [ ] **规范化 Hash 确定性**：
  - 同一拓扑无论节点在数组中如何乱序排列，计算出的 `graphHash` 恒定完全一致；
  - 仅移动节点坐标，`graphHash` 保持不变；修改哪怕一个配置字符，`graphHash` 产生雪崩变化；
- [ ] **结构化 Diff 算法准确性**：
  - 节点新增、删除、配置属性递归变更的路径识别准确率 100%；
  - 仅修改坐标的节点正确标记为 `isLayoutOnly: true`，且 `hasLogicalChanges = false`；
  - 连线增删准确识别端口复合键；
- [ ] **回滚与撤销机制**：
  - 执行回滚后画布拓扑与目标快照完全一致；
  - 执行 `Ctrl+Z` 撤销操作能成功逆转回滚，恢复回滚前的画布状态。

---

## 5. 待审阅架构决策确认 (Architecture Decisions for Sign-off)

1. **配额上限与拒绝策略**：确认单工作流上限设定为 **30 个版本**，且满额后**拒绝新建并提示清理（不采用自动 FIFO 淘汰）**；
2. **纯坐标拖拽的降噪收敛**：确认将“仅节点坐标拖拽”标记为 `layoutOnly`，在 UI 中默认折叠且不计入逻辑变更（避免审查噪声）；
3. **回滚可撤销性**：确认回滚时自动向 `historyManager` 压栈，支持用户使用 `Ctrl+Z` 快速反悔；
4. **版本号冻结**：确认在整个研发与测试推进期间全面冻结版本号变动，测试与代码中统一维护既有契约。

