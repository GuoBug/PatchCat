# M3 模型级联路由与状态机实测评估报告（多模型轮换池实测版）

> **评测时间**：2026-10-01T14:49:08.179Z  
> **评测环境**：Node.js v24.19.0 / Windows 本地直连  
> **实验模型配比**：
> - **Tier 1 (廉价层)**：`Qwen/Qwen2.5-7B-Instruct`（SiliconFlow 免费通道，`temperature: 0.0` 低抖动基线）
> - **Tier 2 (强模型多候选轮换池)**：`gemini-3.5-flash-lite -> gemini-3.1-flash-lite -> gemini-3.8-flash`（Google AI Studio 免费额度）
> - **账单费用总计**：**$0.00 / ¥0.00 (完全免费零支出)**

---

## 核心结论先行与真实归因 (Executive Summary)

> 🎯 **受处理子集（强模型升级队列，n=3）真实效果：Tier-2 强模型救回率 3/3 (100.0%)**  
> 
> 1. **核心可归因收益（100% 真实级联）**：升级机制成功救回了 **3 例（#16, #23, #27）** 契约硬崩溃。由于升级触发条件为廉价预算耗尽且两臂廉价层同构，该子集按构造选自基线失败集，不含结构性“恶化”可能。
> 2. **全量表观指标去噪声剖析**：全量契约合规率呈现的 +10.0%（3 例）表观改善中，**100% 对应受处理子集的真实级联增益（3 例（#16, #23, #27）），未升级用例呈现 0 采样噪声（27/27 逐例完全一致）**。
> 3. **统计显著性检视**：配对 McNemar 检验显示契约合规 $p = 0.25$，分类准确 $p = 0.25$，均未达 $\alpha=0.05$ 显著性水平。结论定性为**小样本下方向性积极的架构实证**，不可过度外推为大样本显著效应。

---

## 核心指标实测对比

| 指标项 (Metrics) | 对照组 A (纯廉价模型基线) | 实验组 B (M3 级联路由 Cheap-First) | 变化差值 (Delta) | 统计检验 (McNemar p) / 归因性质 |
|---|---|---|---|---|
| **受处理子集救回率 (Treated Cohort)** | N/A（未施加升级） | **3/3 (100.0%)** | **净救回 3 例** | **100% 真实级联处理归因 (按构造无恶化可能)** |
| **契约合规率 (Schema Compliance)** | 90.0% (27/30) | 100.0% (30/30) | **+10.0%** | $p = 0.25$ (3 真实救回 + 0 采样噪声) |
| **分类准确率 (Category Accuracy)** | 76.7% (23/30) | 86.7% (26/30) | **+10.0%** | $p = 0.25$ (3 真实 + 0 噪声 - 0 反向) |
| **单号提取准确率 (OrderId Accuracy)** | 90.0% (27/30) | 100.0% (30/30) | **+10.0%** | $p = 0.25$ |
| **F7 动作优先权穿透率 (#27, #30)** | 50.0% | 100.0% | **+50.0%** | 单例(#27)契约自愈救回，门禁未触发 (不具统计普适性) |
| **廉价模型闭环率 (Cheap Closure)** | 100.0% | **90.0%** | 保持高闭环率 | 流量锁定在极低成本 Tier 1 |
| **强模型升级率 (Escalation Rate)** | 0.0% | **10.0%** (3/30) | 触发定向升级 | 针对困难长尾精准触发 |
| **累计 Token 消耗 (Total Tokens)** | 39,765 tokens | 48,436 tokens | **+21.8%** | 额外消耗集中于 3 例升级任务 |
| **平均端到端耗时 (Avg Latency)** | 9073ms | 10047ms | **+974ms (+10.7%)** | 落在公网 API 负载波动带内 (±42%)，不作架构性能结论 |

---

## 架构价值与深度复盘

### 1. 受处理子集真实归因与逐例剖析 (Treated Cohort Breakdown)
实验组共触发 3 例强模型定向升级，这是检验级联有效性的核心样本：
- **Case #16 (refund_polite_leisurely)**: 对照组=`err` -> 级联组=`refund` (最终接管模型: `gemini-3.1-flash-lite`, 触发原因: `cheap_budget_exhausted`)
  - 候选尝试链: [#1 gemini-3.5-flash-lite: contract_fail (合规要求：高优先级工单 (urgency ≥ 4) 的 summary)] -> [#2 gemini-3.1-flash-lite: ok]
  - 判定: **✅ 改善 (真实级联救回)**
- **Case #23 (refund_price_guarantee)**: 对照组=`err` -> 级联组=`refund` (最终接管模型: `gemini-3.5-flash-lite`, 触发原因: `cheap_budget_exhausted`)
  - 候选尝试链: [#1 gemini-3.5-flash-lite: ok]
  - 判定: **✅ 改善 (真实级联救回)**
- **Case #27 (quality_fake_product_counterfeit)**: 对照组=`err` -> 级联组=`refund` (最终接管模型: `gemini-3.1-flash-lite`, 触发原因: `cheap_budget_exhausted`)
  - 候选尝试链: [#1 gemini-3.5-flash-lite: contract_fail (业务红线：退款类工单涉及资金流转，urgency 必须 ≥ 4)] -> [#2 gemini-3.1-flash-lite: ok]
  - 判定: **✅ 改善 (真实级联救回)**
- **净改善归因**：在候选轮换与现场诊断三元组继承支持下，受处理子集（共 3 例强模型升级）实现了 **3 改善 / 0 恶化 / 0 持平**。真实救回用例（#16, #23, #27）经历了完整的廉价自愈失败现场诊断三元组继承与候选模型修复闭环。
- **跨轮稳定性局限说明**：必须诚实指出，受处理子集用例构成在不同轮次间存在边界漂移（仅 #16 跨轮绝对稳定，其他边缘用例因云端托管模型采样微抖动在廉价预算耗尽边界存在轻微浮动），解读该子集指标时需结合单例病理（如 #27 实为契约硬崩溃）综合审视。

### 2. 采样低抖动验证与未升级用例一致性 (Sampling Low-Jitter & Un-escalated Consistency)
- 在全量 30 个基准工单中，未触发级联升级的 27 个用例一致性达到 **100.0%** (27/27)。
- **显式不一致用例审计**：共有 **0 例** 在两组中输出不一致（双臂在完全对齐初始提示词与结构化约束下实现了 100% 低抖动重现）。
  - 云端托管 LLM API（如 Qwen2.5-7B）在 `temperature: 0.0` 下受动态批处理、并发调度及 MoE 路由影响，**不保证数学意义上的绝对确定性**。
  - 表观增益与真实级联增益完全吻合（0 例采样噪声，0 例反向抖动），有力印证了初始 Schema 契约注入对齐后消除系统性假性偏差的效果。


### 3. F7 动作优先权门禁与 Case #27 实证分析
- **门禁触发状态**：本轮评测中 `semantic_conflict_gate` 动作优先权门禁**未被触发**（本轮升级原因全部分布于 `cheap_budget_exhausted`）。
- **Case #27 与 #30 实测归因**：
  - **Case #27**：对照组分类为 `null`，级联组分类为 `refund`（由 `gemini-3.1-flash-lite` 接管，原因: `cheap_budget_exhausted`）。必须严谨指出：对照组在 #27 上的真实病理是**廉价自愈耗尽导致的契约硬崩溃**（未能输出合法 JSON），而非狭义上输出合法 Schema 但被描述词遮蔽的“纯语义 F7”。级联组经强模型升级（由 `gemini-3.1-flash-lite` 接管，原因: `cheap_budget_exhausted`）后最终分类命中 `refund`。因门禁未触发且升级原因为廉价预算耗尽，**不能据此断言语义消歧突破**；该表观指标由 #27 单例驱动，不具统计普适性。
  - **Case #30**：对照组与级联组分类均为 `refund`，在 Tier 1 廉价模型上直接闭环，两组均准确判定。

### 4. 多候选模型轮换队列与逐候选调用归因
本轮在 3 例强模型升级中，共有 **2 例** 触发了候选队列的故障转移（Failover）：
- **Case #16**: 候选 1 (gemini-3.5-flash-lite) 状态=`contract_fail` [合规要求：高优先级工单 (urgency ≥ 4) 的 summary 至少需要 15 字] 耗时=1640ms ➔ 候选 2 (gemini-3.1-flash-lite) 状态=`ok` 耗时=3644ms
- **Case #27**: 候选 1 (gemini-3.5-flash-lite) 状态=`contract_fail` [业务红线：退款类工单涉及资金流转，urgency 必须 ≥ 4] 耗时=2161ms ➔ 候选 2 (gemini-3.1-flash-lite) 状态=`ok` 耗时=1381ms
实测证明：当首选模型出现 `contract_fail` 时，状态机无缝顺延至后续候选模型完成修复闭环，验证了多候选容灾池的混合保障能力。

### 5. 工程代价与成本-收益量化权衡 (Cost-Benefit Trade-offs)
- **Token 消耗**：累计 Token 增加 +21.8%（+8,671 tokens），额外开销完全集中在 3 例升级任务中，平均每例升级消耗约 **2,890 tokens**。
- **端到端耗时**：平均端到端耗时变动 **+974ms (+10.7%)**。经跨轮基线横向比对（基线在同一代码下的历史平均延迟在 3.8s–9.1s 宽幅波动，波幅达 ±42%），单轮内的毫秒级耗时差异主要受公网网络抖动与第三方 API 并发负载噪声主导，落在系统噪声带内，不作为级联路由的架构性能结论。
- **权衡决策建议**：
  - 在当前免费配额模式下，金钱成本为 **$0.00**；
  - 在商业付费生产环境下，每挽救 1 例契约崩溃任务需额外消耗约 **2,890 tokens**（单次强模型升级均值约 **2,890 tokens**）。对高价值业务单（退款纠纷、大客户工单）而言极具性价比；若面向低价值高吞吐场景，建议调小 `maxCheapRetries` 或收紧升级准入条件。

---

## Case 详细追踪明细

| Case ID | 类别 (Expected) | 对照组分类 | 级联组分类 | 最终执行模型 | 闭环与升级状态 (Status) | 候选轮换链路 (Attempts Trace) |
|---|---|---|---|---|---|---|
| #01 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #02 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #03 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #04 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #05 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #06 | `other` | `other` | `other` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #07 | `refund` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #08 | `logistics` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #09 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #10 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #11 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #12 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #13 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #14 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #15 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #16 | `refund` | `err` | `refund` | `gemini-3.1-flash-lite` | `cheap_budget_exhausted` | #1 gemini-3.5-flash-lite (contract_fail) ➔ #2 gemini-3.1-flash-lite (ok) |
| #17 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #18 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #19 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #20 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #21 | `other` | `other` | `other` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #22 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #23 | `refund` | `err` | `refund` | `gemini-3.5-flash-lite` | `cheap_budget_exhausted` | #1 gemini-3.5-flash-lite (ok) |
| #24 | `other` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #25 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #26 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #27 | `refund` | `err` | `refund` | `gemini-3.1-flash-lite` | `cheap_budget_exhausted` | #1 gemini-3.5-flash-lite (contract_fail) ➔ #2 gemini-3.1-flash-lite (ok) |
| #28 | `other` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #29 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #30 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |

---

> **关于作者**  
> **郭强 (GuoBug)**，Product Engineer，做平台工程也做业务增长。目前主要在折腾 AI 工作流编排、DAG 状态机与确定性系统架构。  
> 开源项目与主页：[https://github.com/GuoBug](https://github.com/GuoBug) · [https://guobug.github.io](https://guobug.github.io)  
> 欢迎就工作流引擎架构、拓扑调度和低门槛开发体验交流指教。
