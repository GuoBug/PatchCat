# PRD-020: MemoryNode 画布记忆原语与工作流版本快照

> **状态**：草案 (Draft · 待评审)  
> **版本**：0.1.0  
> **负责人**：Guo Qiang (GuoBug)  
> **最后更新**：2026-10-13  
> **关联文档**：[PRD-010: 会话记忆与存储架构](PRD-010-Conversation-Memory-and-Storage-Architecture.md)、[PRD-016: 不可变快照与断点续跑](PRD-016-Immutable-Checkpointing-and-Resumable-DAG-Execution.md)、[PRD-017: 端侧数据主权](PRD-017-Local-Data-Sovereignty-and-Storage-Hardening.md)  
> **源码对齐**：`src/components/panels/ChatDebugPanel.tsx`、`src/services/memory/rolling-summarizer.ts`、`src/services/storage/session-storage.ts`、`src/engine/browser-engine.ts`、`src/engine/history-manager.ts`、`src/services/storage/indexeddb-adapter.ts`

---

## 0. 范围裁剪（先于一切）

ROADMAP 与 NEXT_STEPS 对 v0.4.20 的描述合计 4 项交付：

| # | 交付项 | 来源 | 本 PRD 建议 |
| :--- | :--- | :--- | :--- |
| A | `MemoryNode` 画布原语 | ROADMAP + NEXT_STEPS | **v0.4.20 交付** |
| B | 工作流版本快照 + 结构化 Diff + 回滚 | ROADMAP + NEXT_STEPS | **v0.4.22 交付**（本 PRD 一并定契约） |
| C | `.patchcat` 单文件归档包 | ROADMAP | 延后：依赖 B 的版本格式与 KB 导出，单独立项 |
| D | 跨工作流记忆联邦 | 仅 NEXT_STEPS | 延后：需先有 A 的作用域模型，否则无从定义"共享" |

理由：项目坚持 ~0.0.2 微步节奏，A 与 B 均触碰持久化层（B 需 IndexedDB v7），合并交付会让回归面过大。

---

## 1. 现状核验

### 1.1 记忆注入只存在于 UI 层
`chat_summary` / `chat_history` / `conversation_history` 仅在 `ChatDebugPanel.tsx:571-585` 通过 `buildContextInjectionBag` 写入 `inputsBag`。引擎（`browser-engine.ts`）对会话一无所知：

- 从画布顶部「运行」按钮执行时，记忆变量**不存在**，Prompt 中引用 `{{chat_history}}` 会解析为空；
- 记忆读写策略（窗口轮数、Token 预算）只能在工作流级 `memoryConfig` 配一套，**无法按节点差异化**（例如路由 LLM 只需摘要、回答 LLM 需要完整近期窗口）；
- 记忆行为在 DAG 上不可见，违背"流程即文档"的画布定位。

### 1.2 不存在版本存储
- `history-manager.ts`：25 步纯内存撤销栈，刷新即失；
- `checkpoints` 仓库：PRD-016 的**执行**快照（节点输出），不是**拓扑**版本；
- 结论：B 需要新建存储，不能复用以上两者。

---

## 2. Part A：MemoryNode（v0.4.20）

### 2.1 节点定位
`MemoryNode` 是一个**只读**的数据源节点：从当前会话中按节点配置取出记忆，作为输出供下游 Prompt / LLM / Agent 引用。

```
[MemoryNode: 近期 4 轮 + 摘要] ──► [Prompt] ──► [LLM]
                               └──► [Agent]
```

### 2.2 为什么 v1 只读（关键决策，待确认）
写入（把本轮回答追加回会话）目前由 `ChatDebugPanel` 在运行结束后统一完成。若 MemoryNode 也能写，会出现：

1. **双写**：面板持久化一次，节点再写一次；
2. **重放重复写**：PRD-016 断点续跑与单节点就地重试会再次执行写节点，副作用非幂等；
3. **Dry-Run 污染**：`skipLLM: true` 的模拟回答被写进真实会话。

v1 保持"面板是唯一写入方"，MemoryNode 只读，可彻底规避以上三类问题。写模式需要幂等键（`runId + nodeId`）与 Dry-Run 屏蔽，列为后续项。

### 2.3 配置契约
```typescript
export interface MemoryNodeConfig {
  /** 输出内容 */
  include: {
    summary: boolean;        // 滚动摘要 (chat_summary)
    recentWindow: boolean;   // 近期逐字窗口 (chat_history)
    pinned: boolean;         // 置顶消息 (isPinned)
  };
  recentRounds: number;      // 覆盖工作流级 maxHistoryRounds；缺省继承
  maxTokens: number;         // 本节点输出 Token 上限；0 = 继承工作流级预算
  format: 'text' | 'messages'; // 文本拼接 或 ChatML 消息数组（供 LLM 节点直接作为 history）
}
```

### 2.4 输出契约
```typescript
{
  summary: string;              // 无摘要时为 ''
  history: string | Message[];  // 取决于 format
  pinned: string;
  meta: {
    session_status: 'active' | 'empty' | 'no_session';
    rounds: number;
    tokens: number;
    truncated: boolean;
  };
}
```

### 2.5 会话来源（引擎需新增的唯一入口）
- `WorkflowRunOptions` 新增可选 `sessionKey?: string`；
- `ChatDebugPanel` 运行时传入当前会话键；
- **画布「运行」按钮无会话**：MemoryNode 输出空值并置 `meta.session_status = 'no_session'`，节点徽章显示灰色提示。**绝不抛错、绝不阻塞下游**（与 L4 Never-Throw 契约一致）。

### 2.6 与现有隐式注入的共存
- 工作流**不含** MemoryNode：行为 100% 不变，面板继续隐式注入（零回归）；
- 工作流**含** MemoryNode：面板仍注入全局变量（保证旧 Prompt 不坏），MemoryNode 输出以 `{{memory_1.history}}` 形式独立引用，两者不互相覆盖。

### 2.7 边界与代价
- 子工作流：`SubWorkflowNode` 已对上下文做 `structuredClone` 隔离，`sessionKey` **不向子流程传递**（v1），子流程内 MemoryNode 恒为 `no_session`；
- 断点续跑：MemoryNode 只读且输出由会话决定，续跑时**重新读取**而非复用缓存（会话可能已有新轮次），需在 PRD-016 的祖先缓存规则中把它标记为 non-cacheable；
- Flow Preflight：MemoryNode 无上游依赖，可作为源节点；当 `include` 全部为 false 时给 lint 警告。

---

## 3. Part B：工作流版本快照（v0.4.22，本 PRD 先定契约）

### 3.1 存储
IndexedDB 升级至 `DB_VERSION = 7`，新增仓库 `workflow_versions`：
```typescript
export interface WorkflowVersion {
  id: string;                // uuid
  workflowId: string;        // index: by_workflow
  label: string;             // 用户命名，如 "v1.2 加了重排"
  createdAt: number;
  graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }; // 已剥离运行态
  graphHash: string;         // 规范化 JSON 的 SHA-256，用于去重
}
```
- **只存拓扑与配置**：保存前复用 `workflow-sanitizer.ts` 的 `clearExecutionOutputs` 逻辑剥离 `outputs` / 状态 / 高亮；
- **API Key 不入版本**：同样复用 `stripApiKeys`，与 PRD-017 零明文红线一致；
- **v1 只做手动命名快照**，不做自动快照（避免与 800ms 自动保存叠加产生大量版本）；
- 配额：单工作流上限 30 个版本，达到上限时**拒绝新建并提示删除**，不静默淘汰用户命名的版本（区别于 checkpoints 的 FIFO）。

### 3.2 结构化 Diff（不做文本 JSON Diff）
按节点 `id` 对齐，输出三类变更：

| 类别 | 判定 | 展示 |
| :--- | :--- | :--- |
| 节点增 / 删 | id 只存在于一侧 | 画布绿/红描边 |
| 节点配置改 | 同 id，`data.config` 深比较不等 | 字段级 before/after 列表 |
| 连线增 / 删 | 以 `source+sourceHandle+target+targetHandle` 为键 | 绿/红虚线 |

- **坐标变化单独归为"仅布局变更"并默认折叠**：拖动节点不应淹没真实的逻辑差异；
- 长文本字段（Prompt 模板）做行级 diff。

### 3.3 回滚
- 回滚 = 以目标版本内容**覆盖当前画布**，并作为一步压入撤销栈（可 `Ctrl+Z` 撤回回滚）；
- 回滚前若当前画布与最新版本 `graphHash` 不同，弹窗提示"当前有未存为版本的改动"，提供「先存为版本再回滚」选项。

---

## 4. 验收标准

### Part A（v0.4.20）
- [ ] `tests/memory-node.node.test.ts` 接入测试清单；
- [ ] 无 `sessionKey` 时输出空值 + `no_session`，下游正常执行；
- [ ] `include` / `recentRounds` / `maxTokens` / `format` 各组合输出正确，置顶消息不受窗口裁剪；
- [ ] 断点续跑时 MemoryNode 重新读取而非命中缓存；
- [ ] 子工作流内 MemoryNode 恒为 `no_session`；
- [ ] 不含 MemoryNode 的全部既有预设与测试零回归；
- [ ] 中英双语节点标签、属性面板与 Tooltip，英文资源零中文字符。

### Part B（v0.4.22）
- [ ] IndexedDB v6 → v7 幂等升级，既有仓库数据不丢失；
- [ ] 版本内容不含 `apiKey` 与运行输出；
- [ ] Diff 正确区分逻辑变更与仅布局变更；
- [ ] 回滚可被撤销；达到 30 上限时拒绝而非淘汰。

---

## 5. 开放问题（需作者决策）

1. **范围裁剪**：是否同意 v0.4.20 只交付 MemoryNode，版本快照顺延到 v0.4.22，归档包与记忆联邦另行立项？
2. **只读 vs 读写**：是否同意 MemoryNode v1 只读、面板保持唯一写入方？
3. **画布运行无会话**：输出空值 + 灰色提示是否可接受？备选方案是给每个工作流一个默认会话，让画布运行也能读到最近一次面板对话。
4. **版本配额**：30 个上限、满额拒绝（不自动淘汰）是否合适？
