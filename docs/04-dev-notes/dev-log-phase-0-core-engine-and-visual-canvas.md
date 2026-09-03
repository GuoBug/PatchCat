# 开发日志：Phase 0 - 核心拓扑调度引擎与可视化画布构建

> **开发周期**: 2026-08-28 ~ 2026-08-31  
> **协作者**: Guo Qiang (GuoBug) & Antigravity (AI Pair Programming)  
> **阶段定位**: 项目奠基（Genesis & Canvas Core）  
> **关联文档**:  
> - [PRD-001: Visual Workflow Canvas & Node Components](../01-prd/PRD-001-Workflow-Canvas.md)  
> - [PRD-002: DAG Topological Scheduler & Multi-Level Logger](../01-prd/PRD-002-DAG-Execution-Engine.md)  
> - [ADR-001: Visual Canvas Engine Selection](../04-dev-notes/adr-001-canvas-engine-selection.md)  

---

## 1. 缘起与痛点：为什么要做 PatchCat？

在日常使用市面上各类大模型工作流编排工具时，我们常常面临两个极端的困扰：
- **要么过于庞大沉重**：必须依赖云端订阅或在本地拉起庞大的 Docker 全家桶（包含 Redis、Celery、Postgres、MinIO 等），环境准备极高；
- **要么交互过于黑盒**：很多轻量工具无法直观呈现 DAG（有向无环图）执行波次、节点间数据流转与耗时，一旦发生死锁或依赖错误排查十分困难。

我们希望借助 **AI 结对辅助编程（AI Pair Programming）**，以“边写边学（Learning by Doing）”的方式，从底层算法出发，从零打造一款**零门槛、纯本地优先、具备实时交互反馈的 AI 提示流编排器 —— PatchCat**。

---

## 2. 关键节点双向共创 (Milestone Co-Discovery)

项目推进过程中，人与 AI 形成了清晰的“业务体验 ⇄ 工程底座”互补协作：

| 关键决策节点 | 人类提出（产品定位与交互体验） | AI 提出（底层工程规约与系统隐患） |
| :--- | :--- | :--- |
| **有向图调度机制** | 节点间需要支持分支并发、汇聚与跨节点传参，必须提供直观的运行反馈。 | 警告多节点可能出现**环路死锁（Cycle Deadlock）**风险；提议引入 **Kahn 拓扑排序算法**，并在运行前按无入度节点切分并行执行波次（Execution Layers）。 |
| **动态变量插值安全** | 用户能在下游节点使用类似 `{{input_1.user_query}}` 的语法引用上游任意节点的数据。 | 警告动态对象属性访问可能引发**原型链污染（Prototype Pollution）**；提议严格过滤 `__proto__`、`constructor`、`prototype` 等敏感属性。 |
| **画布技术选型** | 画布必须具备现代科技质感，拖拽、缩放、连线在 60fps 下极其丝滑。 | 对比原生 SVG、Canvas 与 React Flow；最终选型 **React Flow v12 (@xyflow/react)**，采用状态下沉切片模式，避免整画布脏重绘。 |
| **环路可视化防御** | 当用户手误连成闭环时，不能只在控制台报错，必须在界面上即时预警。 | 提出在每次 `edges` 连线变动时实时触发拓扑预检，通过**发光呼吸脉冲红线**和顶部 Warning 徽章定位具体死锁节点。 |

---

## 3. 核心功能实现细节

### 3.1 基于 Kahn 算法的波次拓扑调度引擎 (`src/engine/topological-sort.ts`)
- 统计所有节点的入度（In-degree）并构建邻接表；
- 循环提取入度为 0 的节点集合划为同一个执行波次（Layer），波次内各节点通过 `Promise.all` 并发执行；
- 执行完毕后动态扣减下游节点入度，若最终处理节点数小于总节点数，则精准捕获并提取成环节点列表（`cycleNodes`）。

### 3.2 变量解析与插值引擎 (`src/engine/variable-resolver.ts`)
- 支持正则提取 `{{nodeId.propertyPath | 'fallback'}}` 占位符；
- 深度路径访问支持数组索引与嵌套对象解析；
- 内置针对原型污染的安全守卫代码，彻底杜绝对象属性逃逸。

### 3.3 可视化画布与基础五节点体系 (`src/components/nodes/`)
- 抽象统一卡片容器 `BaseNode`，定义统一插桩规范与执行状态样式；
- 交付 5 种核心节点：
  - `InputNode`（输入节点：参数 Key-Value 表）；
  - `PromptNode`（提示词模板节点：动态槽位识别与插值预览）；
  - `LLMNode`（大模型调用节点：模型参数配置与状态显示）；
  - `CodeNode`（轻量 JS 脚本转换节点：入参转换与条件路由）；
  - `OutputNode`（输出节点：结果汇聚与渲染展示）。
- **交互创新**：
  - 连线悬浮剪刀按钮（点击即刻切断连线）；
  - 环路连线动态红色脉冲流光。

### 3.4 品牌形象确立与明暗主题
- 创立 **PatchCat** 独眼海盗赛博猫品牌视觉标识；
- 实现 **Modern Slate & Indigo** 明亮模式与 **Cyberpunk Dark Slate** 暗黑模式的一键实时无缝切换。

---

## 4. 严苛的混沌工程测试 (Chaos Benchmarks)

针对拓扑执行引擎，作者主动设计并编写了 4 项极限工程基准用例 (`tests/engine.node.test.ts`)：
1. **并发时延压测 (Concurrency Timing)**：验证并行分支执行耗时为 $\max(T_i)$ 而非 $\sum T_i$；
2. **执行中途熔断测试 (In-flight Abort)**：通过 `AbortSignal` 验证中途强制终止能即刻切断运行队列；
3. **单节点错误冒泡测试 (Error Bubbling)**：验证上游节点异常会立刻中断下游后续波次，并规范抛出 `NODE_ERROR`；
4. **孤立悬空边负向断言 (Dangling Edge Assertion)**：验证非法悬空连线在预检阶段即被安全拦截。
5. **电商 6 节点多 Agent 退款仲裁流水线**：端到端验证买家诉求拆解、卖家抗辩、合规校验、智能仲裁的全流程数据流转。

所有单元测试在 Node.js 原生测试运行器下 **100% 绿灯通过**。
