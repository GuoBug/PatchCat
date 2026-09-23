---
title: "ADR-003: 确定性执行架构抉择 —— 从 Event Sourcing 与 Checkpointing 之争到 Linux 工具哲学落地"
version: "1.0.0"
status: "Accepted"
author: "郭强 (GuoBug) & PatchCat Architecture Team"
created: "2026-09-23"
updated: "2026-09-23"
tags: ["Architecture", "DAG State Machine", "Event Sourcing", "Checkpointing", "Local-First", "Unix Philosophy"]
---

# ADR-003: 确定性执行架构抉择 —— 从 Event Sourcing 与 Checkpointing 之争到 Linux 工具哲学落地

## 核心金句先行 (Quotable Snippet)

> **“在 AI 工作流编排的确定性设计中，最危险的陷阱是试图用一个‘看起来很酷’的重型模式解决所有问题。Event Sourcing 将存储、状态机、重放解释器与审计强行捆绑，违背了通用数据接口的自包含性；而纯正的 Linux 工具哲学告诉我们：一个工具只做好一件事，保持数据为自包含的静态 JSON，复杂的任务靠轻量积木组合完成。”**

---

## 一、 背景与思想碰撞起点：从 Patchwork 离线优先说起

在探索 PatchCat（轻量端侧 AI 工作流编排器）的**离线优先（Local-First）与确定性调度**底座时，我们复盘了去中心化社交领域最著名的先驱项目——基于 Secure Scuttlebutt (SSB) 协议的经典客户端 **Patchwork**。

Patchwork 实现了真正的离线优先：数据纯本地存储、不可篡改追加日志、完全免除中心化云端服务器依赖。但它最终走向退役（Archived），给开源世界留下了极其深刻的工程教训：
1. **发明非标自研全家桶的恶果**：自研 `depject`（依赖注入）与 `mutant`（DOM 响应式），脱离了主流生态，直接导致后续无人能够维护；
2. **缺乏垃圾回收与快照**：无限累积的追加日志导致存储无休止膨胀，冷启动延迟雪崩；
3. **存储层与业务逻辑死锁**：业务代码与老旧数据库强耦合，彻底丧失升级弹性。

为防止 PatchCat 重蹈覆辙，我们确立了**三大架构防坑工程红线**：
* **红线 1**：死守通用标准生态（React Flow、Zustand、IndexedDB、Web Worker），严禁自研黑盒框架；
* **红线 2**：时态数据强隔离，LLM 逐字 Streaming Token 等瞬态流（Ephemeral）严禁落盘，仅留内存；
* **红线 3**：存储强契约解耦（`IStorageAdapter`），核心调度器与持久化引擎彻底隔离。

---

## 二、 关键节点双向共创：Event Sourcing 与 Checkpointing 的深度辩证

在讨论**“如何实现 DAG 状态机的崩溃恢复、断点续跑与时光倒流”**时，我们经历了一场极具价值的架构推演与理念碰撞：

### 1. 初步方案碰撞
* **流派 A（原位就地覆写 In-place Mutable State）**：Dify/Flowise 式的传统做法，数据库直接 `UPDATE status = 'RUNNING'`。最简单，但在崩溃时丢失一切中间态，无法满足严肃 AI 调试的确定性要求。
* **流派 B（不可变事件流 Event Sourcing / Append-Only Log）**：Temporal 式的事件驱动，只追加动词事件（`NODE_STARTED`, `NODE_COMPLETED`），当前状态通过事件流重放（Replay）还原。
* **流派 C（节点级检查点快照 Node Checkpointing Snapshot）**：LangGraph 式的快照法，每个拓扑波次/节点完成时保存当前完整状态切片。

### 2. AI 提出的底层工程隐患
AI 协助剖析了流派 B 在企业级实践中的三道隐形大坑：
1. **粒度失控陷阱（Granularity Trap）**：若将模型 Streaming Token 或界面像素微调作为 Event 落盘，单次执行写入数千条事件，前端 IndexedDB 会被瞬间写崩；
2. **Schema 演进地狱（Upcaster Burden）**：历史事件具有不可变性，一旦未来调度器调整字段，必须编写并维护繁琐的向上兼容转换器；
3. **重放计算开销（Replay Latency）**：事件累积过多时，每次刷新页面都必须用 Reducer 全部计算一遍才能获得当前画布状态。

### 3. 作者（GuoBug）的哲学破局：以 Linux 工具哲学定音
面对“折中方案往往两头不讨好”的疑虑，作者郭强（GuoBug）从产品工程与底层系统哲学的交汇点提出了关键定论：

> **“项目的小颗粒度应该达到 Linux 工具的设计理念：一个简单的工具，完成一个任务就可以；复杂的任务，靠工具的组合完成。”**

这一论断彻底击中了 Event Sourcing 在轻量端侧工具中的软肋，确立了 **方案 C（检查点快照）** 的绝对正当性：

| 审视维度 | 流派 B：事件流 (Event Sourcing) | 流派 C：检查点快照 (Linux 哲学落地) |
| :--- | :--- | :--- |
| **数据是否自包含 (Self-Contained)** | ❌ **不自包含**：存下来的只有碎片动作，必须绑定特定的 Reducer 程序才能算出当前数据。 | ✅ **100% 自包含**：每个快照就是一个自包含的静态 JSON，开箱即用，像 Linux 的文本流一样通用。 |
| **单一职责原则 (Single Responsibility)** | ❌ **严重违背**：试图用一套机制强行捆绑持久化、状态机、时光调试与审计。 | ✅ **严格恪守**：快照工具只负责“冻结当前切片”；恢复工具只负责“喂给调度器续跑”。 |
| **复杂任务的完成方式** | 依赖重型框架和事件总线完成。 | **靠极简积木组合完成**：<br>1. *快照存储器*（单点切片落盘）<br>2. *FIFO 滚动清理器*（类似 `logrotate` 防膨胀）<br>3. *Kahn 增量裁剪器*（逆邻接反查祖先，只调度失效分支）<br>4. *可观测性面板*（OTel Trace 解耦呈现） |
| **实现复杂度与心智负担** | 需维护 Reducer、事件定义、版本迁移。 | 代码极其直白，每个积木不超过 100 行，独立可测。 |

---

## 三、 决策定论 (Final Architecture Decision)

**我们正式确立：PatchCat 全面采用「基于 Linux 组合哲学的节点级不可变检查点快照（Node Checkpointing）」作为确定性执行与容错续跑的唯一底层基准。**

### 落地工程规范
1. **快照模型契约**：在波次调度完毕时生成原子 `DAGCheckpoint`，深拷贝当前全局变量上下文（`contextBag`）与各节点产物字典；
2. **存储保护与 FIFO 淘汰**：每个工作流仅保留最近 5 个检查点快照，环形淘汰超额数据，彻底杜绝磁盘溢出；
3. **增量拓扑裁剪调度**：断点续跑时，根据目标节点通过逆邻接表向上广度优先反查祖先集合，100% 复用绿色缓存成果，跳过前序昂贵 LLM 调用，将开销锁死在变动的最小子图上；
4. **可观测性解耦**：将执行耗时、Token 统计与因果调用链交由独立的 OTel Trace 机制处理，杜绝底层存储被可观测性强行绑架。

---

> **关于作者**  
> **郭强 (GuoBug)**，兼具平台工程底蕴与业务增长能力的资深 Product Engineer。  
> 专注于 **AI 工作流编排（AI Workflow Orchestration）**、DAG 状态机与确定性系统架构落地。  
> 开源项目与主页：[https://github.com/GuoBug](https://github.com/GuoBug) · [https://guobug.github.io](https://guobug.github.io)  
> 秉持“边写边学、双向共创”理念，欢迎围绕工作流引擎架构、拓扑调度及低门槛开发体验交流指教。
