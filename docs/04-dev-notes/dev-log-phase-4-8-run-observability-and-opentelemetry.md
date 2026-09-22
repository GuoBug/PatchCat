# Dev Log (Phase 4.8): 运行可观测性、节点单步数据快照与 OpenTelemetry 标准对齐

> **版本归属**: `v0.4.8`  
> **关联阶段**: Phase 4.8 Run Observability, Step Snapshot Inspection & OpenTelemetry Tracing  
> **更新日期**: 2026-09-22  
> **项目作者**: Guo Qiang (GuoBug) & AI Pair Programming  

---

## 1. 核心演进与人机协同思考 (Milestone Co-Discovery)

在 PatchCat 迈向 `v0.4.8` 之际，工作流编排已经具备了复杂的条件分支、Agent 自主工具调用以及循环迭代能力。随着拓扑复杂度的提升，**如何让开发者洞悉执行过程中的每一步黑盒**成为决定生产力上限的关键。

本阶段的演进同样依托人机协作与双向启发模型展开：

### 人提的关键点（业务场景、用户体验与商业透明度）
1. **可视化执行回溯诉求**：过去工作流出错或结果不及预期时，开发者只能依赖底部控制台翻阅文本日志。面对复杂的多分支与 Agent 调用，极度需要一个能按“运行历史”查看真实图谱、每一步入参与产出的可视化快照回溯器。
2. **Token 账单与成本透明度**：在工程化提示词调优时，用户最敏感的是单次运行到底花了多少 Token、折合多少美元。工具需要在本地免配置 APM 的前提下，实时算出清晰的开销看板。
3. **Local-First 数据安全红线**：严禁强制将 Trace 数据上报至任何第三方云服务，所有快照与时序数据必须 100% 留在浏览器本地；但同时必须具备向企业主流 APM 系统无缝导出的互操作能力。

### AI 提的关键点（底层工程规约、系统隐患与工业标准）
1. **端侧存储爆炸与配额溢出隐患（Storage Quota & FIFO Eviction）**：如果每次执行都毫无节制地将全量节点入参和 LLM 产出快照写入 IndexedDB，随着多轮测试和大型文档 RAG 的运行，浏览器本地数据库会迅速膨胀并触发 `QuotaExceededError`。必须设计以工作流为维度的 **10-Record FIFO 环形淘汰机制**。
2. **状态深拷贝与引用污染（Immutable Snapshot Invariant）**：如果单步快照直接引用运行时的上下文对象，后续单节点就地重试（Local Retry）或用户修改画布节点属性时，历史快照数据会被静默篡改（Mutation Hazard）。必须在执行引擎层使用 `structuredClone` 完成不可变快照隔离。
3. **OpenTelemetry & OpenInference 工业契约对齐**：不可闭门造车发明私有 Trace 协议。业界的 OpenTelemetry / OpenInference 对根 Span、子 Span 层次、LLM Token 属性、首字延迟（TTFT）均有严格的标准语义。在纯端侧实现 W3C Trace Context（128-bit Trace ID / 64-bit Span ID），才能让导出的 JSON 直接接入 Langfuse、Datadog 与 Jaeger。

---

## 2. 边写边学与方案权衡 (Trade-offs & Learning)

针对运行可观测性与 Tracing 的技术架构，团队权衡了三种实现路径：

| 选型方案 | 架构模式 | 优势 | 弊端与工程代价 | 最终结论 |
| :--- | :--- | :--- | :--- | :---: |
| **方案 A** | 纯内存临时存储 | 零存储依赖，实现最轻 | 页面刷新或切换工作流后历史数据全部丢失，无法复盘 | ❌ 否定 |
| **方案 B** | 强制外部 OTel Collector 上报 | 原生企业级 APM 集成 | 违背 Local-First 零门槛免配置原则，依赖 Docker/网络代理 | ❌ 否定 |
| **方案 C** | **端侧 IndexedDB 存储 + W3C OTel 标准对齐 + 按需 JSON 导出** | 零配置即开即用，数据本地自持，支持 FIFO 淘汰，导出即对接企业 APM | 需要在纯前端手写 W3C Trace 上下文与 ResourceSpans 序列化器 | ✅ **采纳 (本版本落地)** |

### 核心模块实现剖析

1. **多厂商 Token 成本核算引擎 (`src/config/model-pricing.ts`)**：
   - 建立了 Google Gemini、DeepSeek、OpenAI、SiliconFlow 及 Ollama 本地模型的百万 Token 计费阶梯矩阵；
   - 实现了多态的 `estimateTokenCostUSD`，能够智能适配不同调用源返回的字段命名（`promptTokens` / `completionTokens` 与 `prompt` / `completion`），对于本地模型或未知模型自动安全降级为 0 成本。

2. **端侧不可变快照与 FIFO 环形淘汰 (`src/services/storage/indexeddb-adapter.ts`)**：
   - 数据库版本升级至 `DB_VERSION = 2`，建立 `run_history` 对象仓库与 `by_workflow` 复合索引；
   - 在保存每次 `RunHistoryRecord` 时，主动查询当前工作流的历史记录总数，当记录达到阈值时自动按照时间戳淘汰最旧记录，将存储开销严格控制在常数级复杂度 $\mathcal{O}(1)$。

3. **纯前端 W3C Trace Context 与 OTel 导出器 (`src/services/telemetry/`)**：
   - `otel-tracer.ts`：通过 Web Crypto API 安全生成 32 位 hex 的 `TraceId` 与 16 位 hex 的 `SpanId`；
   - 编排精细的三级树状 Span 结构：工作流根 Span (`workflow.run`) ➔ 拓扑波次 Span (`wave.X`) ➔ 单节点 Span (`node.<type>.<id>`)；
   - `otel-exporter.ts`：按照 OpenTelemetry OTLP ResourceSpans 标准结构进行序列化，支持端侧动态生成 Blob 文件下载（`patchcat-trace-{traceId}.json`）以及剪贴板一键导出。

4. **UI 交互看板与数据穿透 (`RunHistoryDrawer.tsx` & `StepDataInspector.tsx`)**：
   - 瀑布流甘特图（Waterfall Bar Chart）：根据节点的真实 `startedAt` 毫秒计算相对于工作流启动的百分比偏移，直观展示波次内各节点的并发与耗时占比；
   - 冻结快照模态框（Step Data Inspector）：包含 Inputs、Outputs、Telemetry 三个独立标签页，支持高亮排版与格式化复制。

---

## 3. 极限场景验证与工程质量指标

为了确保端侧可观测性体系的健壮性，作者与 AI 共同编写了 3 套全新自动化测试套件：
- **`tests/model-pricing.node.test.ts`**：
  - 验证主流云厂商计费阶梯换算准确性；
  - 验证 Ollama 免费层及未知模型的零成本兜底；
  - 验证多态入参格式（camelCase 与 flat 属性）的鲁棒解析。
- **`tests/otel-exporter.node.test.ts`**：
  - 验证导出的 JSON 结构严格符合 OpenTelemetry ResourceSpans 标准；
  - 验证 W3C Trace ID（32 字符十六进制）与 Span ID（16 字符十六进制）正则契约。
- **`tests/observability-engine.node.test.ts`**：
  - 模拟多节点并行 DAG 调度，验证节点执行快照的深拷贝不可变性；
  - 验证单工作流超限（>10条）时 FIFO 淘汰算法的正确性。

**质量验收表现**：
- 自动化测试：全量 261 项单元与契约测试通过率 100%（261 passed, 0 failed, 60 test suites）；
- 类型安全：`npm run typecheck` 0 error，严禁破坏性 `any`；
- 生产构建：`npm run build` Vite 一次性构建成功（21.73s）。
