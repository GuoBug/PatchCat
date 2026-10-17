# PRD-021: 画布子图折叠封装与可复用组件契约 (Canvas Subgraph Folding and Reusable Component Contract)

> **状态**：待评审 (Ready for Review)  
> **版本**：1.0.0 (生产级架构与契约详述版)  
> **负责人**：Guo Qiang (GuoBug)  
> **最后更新**：2026-10-17  
> **关联文档**：[PRD-002: DAG 拓扑执行引擎](PRD-002-DAG-Execution-Engine.md)、[PRD-011: Agent 能力与子工作流](PRD-011-Agent-Capabilities-and-Tool-Use.md)、[PRD-012: 画布工效学与交互生产力](PRD-012-Canvas-Ergonomics-and-Interactive-Productivity.md)、[PRD-020: MemoryNode 与工作流版本快照](PRD-020-MemoryNode-and-Workflow-Version-Snapshots.md)  
> **源码对齐**：`src/engine/subgraph/`、`src/components/nodes/CompositeNode.tsx`、`src/components/panels/SubgraphDrawer.tsx`、`src/engine/browser-engine.ts`、`src/stores/workflow-store.ts`

---

## 0. 范围裁剪与交付路线 (Delivery Phasing)

| # | 交付项 | 核心范围与契约 | 优先级 | 交付规划 |
| :--- | :--- | :--- | :--- | :--- |
| **A** | **图论割集算法与端口映射引擎** | 纯逻辑图论边界割集 ($E_{in}, E_{out}, E_{int}$) 提取、复合 Handle 动态编码与无损解散展开 (`unfold`) 算法 | P0 | Phase 4.22 Part A |
| **B** | **可视化复合节点 (`CompositeNode`) 与画布交互** | `Ctrl+G` 一键折叠选中节点、复合节点动态多端口渲染、视口平滑聚焦与防碰撞坐标补偿 | P0 | Phase 4.22 Part B |
| **C** | **抽屉式局部子图微调编辑器 (`SubgraphDrawer`)** | 双击复合节点呼出独立局部视口，支持子节点参数微调、局部试运行与就地保存 | P0 | Phase 4.22 Part C |
| **D** | **拓扑扁平化内联调度器 (Flattening Scheduler)** | 执行期零嵌套开销：将复合节点内联展开至全局 DAG 执行波次，死守 Kahn 拓扑排序与断点续跑契约 | P1 | Phase 4.22 Part D |
| **E** | **本地组件库沉淀与安全归档** | 将复合子图标记为可复用组件，存入 IndexedDB 本地组件仓库，强制剥离 API Key 与运行态 | P2 | 独立立项 |

---

## 1. 现状痛点与架构演进背景

### 1.1 现状与用户体验痛点 (Product Engineer Perspective)
随着 PatchCat 在 RAG 事实质检、多模型级联路由、长程会话与自愈循环等生产级场景的深入应用，工作流规模迅速膨胀：
1. **视觉认知过载 (Cognitive Overload)**：一个包含“前置质检 + 混合检索 + 提示词构造 + 便宜模型试探 + 强模型容灾 + 结构化校验”的完整工业链路往往包含 15~30 个节点和数十条连线。主画布网格极度密集，用户极易在平移与缩放中迷失整体心智模型；
2. **高频重复工程模式缺乏封装**：在多个不同业务工作流中，存在大量高度同构的局部子结构（如“BM25 检索 + Rerank 过滤 + 上下文格式化”、“输入脱敏 + 正则提取”）。目前用户只能依赖多选复制粘贴，一旦底层调整必须逐一手动修改；
3. **现有 `SubWorkflowNode` 的割裂感**：已有的 `SubWorkflowNode` 依赖跳转到另一张独立工作流画布，割裂了当前上下文；用户无法在主画布上直接将一组节点“就地打包收纳”，调试与微调成本较高。

### 1.2 关键节点人机双向共创 (Milestone Co-Discovery)
在推进子图折叠封装架构设计的关键决策点上，体现了产品视角与底层工程的深度启发与权衡：
- **人提的关键点（产品与体验维度）**：
  - **就地折叠零摩擦**：框选节点后按下 `Ctrl+G` 必须瞬间完成收缩，主画布只留下一个精致的复合卡片，连线自动收归到卡片边缘；
  - **无损解散还原 (Undo/Unfold)**：支持随时“解散子图”，原样放回主画布，连线与节点配置必须 100% 精确复原，不得发生布局坍塌；
  - **抽屉式局部微调**：双击复合节点无需跳转页面，在右侧滑出抽屉即可在一个迷你画布中微调内部节点。
- **AI 提的关键点（底层工程与图论规约）**：
  - **图论割边歧义消除**：当外部节点连接内部多个节点，或内部节点连接外部多个节点时，端口必须采用 `${nodeId}__${handleId}` 复合命名空间，防止数据混流；
  - **环路死锁瞬时检测**：折叠操作本质上是图的顶点收缩（Vertex Contraction），若选中的节点集合与其他外部节点存在交替依赖（如 $A \to S_1 \to B \to S_2$），折叠后将直接产生自环或外环死锁，必须在折叠前执行静态拓扑合法性预检；
  - **调度架构权衡：拓扑扁平化 vs. 嵌套子引擎**：如果为每个复合节点启动独立的子引擎实例，会导致断点续跑（PRD-016）、OTel 追踪（PRD-015）和并发流式输出被碎片化隔离。最优解是采用**“设计态模块封装，运行态拓扑扁平化内联 (Flattening Inline)”**，执行前自动将复合节点展开为虚拟波次，对外保持单一 DAG 的调度确定性。

---

## 2. 图论割集与端口映射数学契约 (Mathematical Graph Theory)

### 2.1 割集分解模型 (Cut-Set Decomposition)
设主画布逻辑图为有向无环图 $G = (V, E)$，用户选中的待折叠节点子集为 $S \subset V$（其中 $|S| \ge 2$）。

```
        外部上游 (External Inward)
             [ U1 ]      [ U2 ]
               │           │
      ═════════╪═══════════╪══════════ (割集边界 Ein)
               ▼           ▼
             [ S1 ] ──► [ S2 ]
               │           │           (内部子图 S, Eint)
               ▼           ▼
             [ S3 ] ──► [ S4 ]
      ═════════╪═══════════╪══════════ (割集边界 Eout)
               ▼           ▼
             [ W1 ]      [ W2 ]
        外部下游 (External Outward)
```

边集 $E$ 被严格划分为四类互斥子集：
1. **内部边集 (Internal Edges, $E_{int}$)**：
   $$E_{int} = \{ (u, v) \in E \mid u \in S \land v \in S \}$$
   完全封装进复合节点内部，在主画布上隐藏。
2. **入向割边集 (Inward Cut Edges, $E_{in}$)**：
   $$E_{in} = \{ (u, v) \in E \mid u \notin S \land v \in S \}$$
   其终点 $v \in S$ 代表子图的外部输入依赖，需映射为复合节点左侧的输入 Handle。
3. **出向割边集 (Outward Cut Edges, $E_{out}$)**：
   $$E_{out} = \{ (u, v) \in E \mid u \in S \land v \notin S \}$$
   其起点 $u \in S$ 代表子图对外部的输出交付，需映射为复合节点右侧的输出 Handle。
4. **外部无关边集 (External Edges, $E_{ext}$)**：
   $$E_{ext} = \{ (u, v) \in E \mid u \notin S \land v \notin S \}$$
   拓扑与位置保持完全不变。

### 2.2 复合 Handle 命名空间与映射契约 (Handle Namespace Contract)
为了在无全局重命名的情况下杜绝 Handle 冲突，复合节点对外暴露的 Handle ID 遵循严格确定性规范：

- **输入 Handle ID**：`in__${targetNodeId}__${targetHandle ?? 'default'}`
- **输出 Handle ID**：`out__${sourceNodeId}__${sourceHandle ?? 'default'}`

当主画布折叠为新节点 $C$ 时：
- 每条入向边 $(u, v) \in E_{in}$ 重写为：
  $$e_{in}' = (u, C), \quad \text{targetHandle} = \text{`in\_\_${v}\_\_${originalTargetHandle}`}$$
- 每条出向边 $(u, w) \in E_{out}$ 重写为：
  $$e_{out}' = (C, w), \quad \text{sourceHandle} = \text{`out\_\_${u}\_\_${originalSourceHandle}`}$$

### 2.3 拓扑合法性防死锁判定 (Cycle Prevention Preflight)
并非任意节点集合都可以被合法折叠。如果存在外部节点 $x \notin S$ 使得：
$$\exists s_1, s_2 \in S \quad \text{such that } s_1 \to x \to s_2$$
将 $S$ 收缩为一个顶点 $C$ 后，图将产生环路：$C \to x \to C$。

**折叠前验契约**：
1. 构建当前图的传递闭包或通过深度优先搜索检查：
2. 若存在任意 $s \in S$ 的可达后代节点 $x \notin S$，且 $x$ 的后代包含任意 $s' \in S$；
3. **立即阻断折叠操作**，并在画布顶部弹出精准诊断：
   `无法折叠选中的节点：检测到交错依赖环路 (节点 "${x}" 夹在内部节点之间)，请将 "${x}" 一同纳入选中或调整连线。`

---

## 3. 复合节点数据结构与状态机规约 (Data Schema)

### 3.1 复合节点配置结构 (`CompositeNodeConfig`)
在 `src/engine/types.ts` 中新增 `composite` 专用配置：

```typescript
export interface SubgraphBoundaryPort {
  id: string;               // 复合 Handle ID (如 "in__prompt_1__template")
  originalNodeId: string;   // 原始内部节点 ID
  originalHandleId: string; // 原始端口 ID
  nodeLabel: string;        // 内部节点标题 (用于 Tooltip 显示)
  portType: 'input' | 'output';
  dataType?: string;        // 端口预期数据类型
}

export interface CompositeNodeConfig {
  subgraph: {
    nodes: WorkflowNode[];  // 封装的完整内部节点 (坐标已归一化为子图相对坐标)
    edges: WorkflowEdge[];  // 内部连线 Eint
    inputs: SubgraphBoundaryPort[];   // 暴露的输入端口清单
    outputs: SubgraphBoundaryPort[];  // 暴露的输出端口清单
  };
  collapsedAt: number;      // 折叠时间戳
  colorTheme?: string;      // 复合卡片个性化主题色
}
```

### 3.2 坐标系变换归一化 (Coordinate Space Transformation)
为了确保子图在抽屉画布或独立复用时拥有良好的居中视口，折叠时必须对内部节点的绝对坐标进行归一化：
1. 计算选中节点集合 $S$ 的 AABB 包围盒：
   $$x_{min} = \min_{n \in S} (n.position.x), \quad y_{min} = \min_{n \in S} (n.position.y)$$
   $$x_{max} = \max_{n \in S} (n.position.x + n.width), \quad y_{max} = \max_{n \in S} (n.position.y + n.height)$$
2. 复合节点 $C$ 在主画布上的位置设为包围盒中心：
   $$C.position = \{ x: x_{min}, y: y_{min} \}$$
3. 内部节点的坐标转换为以 $(40, 40)$ 为内边距的相对局部坐标：
   $$n.position_{local} = \{ x: n.position.x - x_{min} + 40, y: n.position.y - y_{min} + 40 \}$$

---

## 4. 可视化交互与工效学设计 (Visual Ergonomics & UX)

### 4.1 主画布复合卡片视觉规范 (`CompositeNode.tsx`)
- **外观风格**：采用蓝紫色微渐变外边框与磨砂亚克力玻璃质感（`bg-slate-900/90 border-indigo-500/50 shadow-xl`），显著区别于常规叶子节点；
- **状态徽章**：
  - 左上角：`[📦 复合子图 · {N} 个节点]` 胶囊徽章；
  - 节点类型小胶囊列表：直观展示内部包含的节点组合（如 `Prompt × 2`、`LLM × 1`、`Condition × 1`）；
- **动态多端口排布**：
  - 左侧：根据 `subgraph.inputs` 动态垂直等距排列输入 Handle，鼠标悬停显示清晰 Tooltip：`来源: [节点标题] -> 端口: [原始名称]`；
  - 右侧：根据 `subgraph.outputs` 动态垂直等距排列输出 Handle；
- **核心操作区**：
  - 点击 `[ 🔍 展开子图 ]` 按钮或双击节点卡片：在右侧平滑滑出 `SubgraphDrawer`；
  - 点击卡片菜单 `[ ⤺ 解散展开 ]`：触发逆向展开状态机。

### 4.2 抽屉式局部子图微调编辑器 (`SubgraphDrawer.tsx`)
- **视口隔离**：宽度 650px 的右侧抽屉，内置完整的独立 Mini React Flow 画布实例；
- **局部微调**：用户可在抽屉内随意拖拽子节点、调整提示词、修改温度参数或重新连线；
- **边界端口显性高亮**：被主画布外部引用的输入/输出 Handle 在抽屉内以高亮霓虹光环（`ring-2 ring-emerald-400`）显著标明，防止用户误删边界端口连线；
- **即时双向同步**：在抽屉中点击“保存并同步”，最新子图拓扑即刻写回主画布的 `CompositeNode.data.config.subgraph`，并触发主画布脏状态追踪与自动保存。

### 4.3 逆向解散展开状态机 (`Unfold Inversion`)
用户点击“解散展开”时，系统按以下原子步骤逆向恢复：
1. **边界边重连逆变换**：
   - 将所有连向 $C$ 输入端口 `in__${nodeId}__${handle}` 的外部连线，重新定向到内部对应节点的原始端口；
   - 将所有从 $C$ 输出端口 `out__${nodeId}__${handle}` 引出的外部连线，重新定向到内部对应节点的原始端口；
2. **坐标绝对化还原**：
   - 将子节点的相对坐标累加回 $C.position$：
     $$n.position = \{ x: C.position.x + n.position_{local}.x - 40, y: C.position.y + n.position_{local}.y - 40 \}$$
3. **图元原子替换与撤销栈**：
   - 将当前主画布压入 `HistoryManager` 撤销历史栈（支持 `Ctrl+Z` 一键撤销解散操作）；
   - 从画布中移除复合节点 $C$，同时将内部节点 $V_C$ 和内部连线 $E_{int}$ 重新注入主画布；
   - 触发一次平滑视口自动聚焦居中（`fitView`）。

---

## 5. 执行引擎规约：拓扑扁平化内联调度器 (Flattening Scheduler)

在执行 DAG 工作流时，系统**坚决摒弃嵌套递归启动多个子引擎实例**的低效方案，而是采用**编译期扁平化内联 (Flattening Inline)**：

```
[ 用户视角：设计态高内聚 ]
[ Input ] ──► [ Composite Node (封装 4 节点) ] ──► [ Output ]

                                 ▼ (引擎预编译内联)

[ 引擎视角：运行态扁平波次 ]
Wave 0: [ Input ]
Wave 1: [ Sub_Node_1, Sub_Node_2 ]
Wave 2: [ Sub_Node_3 ]
Wave 3: [ Sub_Node_4 ]
Wave 4: [ Output ]
```

### 5.1 扁平化展开算法规则
1. **虚拟节点注入**：调度器在计算拓扑波次前，遍历所有 `type === 'composite'` 的节点；
2. **局部边替换**：将复合节点的外部连线与内部连线平滑缝合，生成一份纯粹的全局临时拓扑图 $G_{flat}$；
3. **确定性拓扑排序**：直接对 $G_{flat}$ 应用现有的 Kahn 算法，生成全局执行波次序列；
4. **遥测与数据回填**：
   - 内部节点执行时，其 OpenTelemetry Span 带有父复合节点的命名空间标记：`parentSpan: node.composite.${id}`；
   - 复合节点本身的 `outputs` 自动汇总所有内部输出节点的生成物，供主画布属性面板即时检查；
5. **断点续跑 100% 兼容**：因为物理上仍然是扁平的节点集合，PRD-016 确立的 Checkpoint 续跑机制完全透明生效，无需做任何特殊改造。

---

## 6. 极端场景防御与安全气囊 (Safety Airbags)

| 场景 | 潜在系统隐患 | 确定性防御气囊 |
| :--- | :--- | :--- |
| **选区交错环路** | 折叠后产生隐式自环或跨节点死锁 | 折叠前置 DFS 传递闭包预检，若存在夹心依赖，强行阻断并高亮冲突节点 |
| **误删边界连线** | 用户在抽屉中删除了与主画布关联的端口 | 抽屉保存前检测，若发现外部已连线的端口被删除，弹出警告确认弹窗并标注受损外部连线 |
| **凭据泄漏至组件** | 用户将包含明文 API Key 的复合节点存为公用组件 | 存入组件库前强制调用 `sanitizeWorkflow` 清洗流水线，递归剔除所有 API Key |
| **单节点折叠** | 用户仅选中 1 个节点点击折叠 | 阻断折叠并轻量提示：“子图折叠至少需要选中 2 个及以上节点” |
| **巨型子图嵌套性能** | 复合节点内包含超过 50 个高算力节点 | 抽屉 Mini 画布启用视口虚拟化与 CSS 硬件加速渲染，调度器限制内联深度 $\le 3$ 层 |

---

## 7. 验证标准与测试清单 (Verification & Test Matrix)

1. **图论割集单元测试**：
   - 针对不同拓扑（串行、分叉、汇聚、跨越式直连）精准提取 $E_{in}, E_{out}, E_{int}$；
   - 复合 Handle 命名确定性与反解映射无漂移；
2. **环路死锁预检测试**：
   - 构造合法选区（无环）测试通过；
   - 构造交错依赖（$A \to S_1 \to B \to S_2$）测试，断言精准报错并阻断；
3. **逆向解散展开测试**：
   - 折叠后再解散，比对前后全局拓扑 SHA-256 指纹，断言除选区整体平移外逻辑拓扑 100% 一致；
   - 验证解散操作推入 `HistoryManager` 后，按下 `Ctrl+Z` 可完好重做折叠；
4. **扁平化调度与端到端运行测试**：
   - 构造包含 CompositeNode 的真实端到端工作流，验证各子节点波次调度顺序完全符合因果律；
   - 验证下游节点能正确消费 CompositeNode 暴露的输出数据。

---

> **关于作者**  
> **郭强 (GuoBug)**，Product Engineer，做平台工程也做业务增长。目前主要在折腾 AI 工作流编排、DAG 状态机与确定性系统架构。  
> 开源项目与主页：[https://github.com/GuoBug](https://github.com/GuoBug) · [https://guobug.github.io](https://guobug.github.io)  
> 欢迎就工作流引擎架构、拓扑调度和低门槛开发体验交流指教。
