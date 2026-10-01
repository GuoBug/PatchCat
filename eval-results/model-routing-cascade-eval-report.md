# M3 模型级联路由与状态机实测评估报告（多模型轮换池实测版）

> **评测时间**：2026-10-01T12:32:57.577Z  
> **评测环境**：Node.js v24.19.0 / Windows 本地直连  
> **实验模型配比**：
> - **Tier 1 (廉价层)**：`Qwen/Qwen2.5-7B-Instruct`（SiliconFlow 免费通道，`temperature: 0.0` 低抖动基线）
> - **Tier 2 (强模型多候选轮换池)**：`gemini-3.5-flash-lite -> gemini-3.1-flash-lite -> gemini-3.8-flash`（Google AI Studio 免费额度）
> - **账单费用总计**：**$0.00 / ¥0.00 (完全免费零支出)**

---

## 核心结论先行与真实归因 (Executive Summary)

> 🎯 **受处理子集（强模型升级队列，n=3）真实效果：1 改善 / 0 恶化 / 2 持平**  
> 
> 1. **核心可归因收益（100% 真实级联）**：升级机制成功救回了 **1 例（#16）** 契约硬崩溃，并在其余 2 例（#23, #27）上平稳闭环。
> 2. **全量表观指标去噪声剖析**：全量契约合规率呈现的 +10.0%（3 例）表观改善中，**真实级联增益占 1 例（#16），其余 2 例（#01, #17） 来自未升级用例在托管 API 上的采样残留抖动**。分类准确率中亦包含 1 例（#07） 反向抖动。
> 3. **统计显著性检视**：配对 McNemar 检验显示契约合规 $p = 0.25$，分类准确 $p = 0.625$，均未达 $\alpha=0.05$ 显著性水平。结论定性为**小样本下方向性积极的架构实证**，不可过度外推为大样本显著效应。

---

## 核心指标实测对比

| 指标项 (Metrics) | 对照组 A (纯廉价模型基线) | 实验组 B (M3 级联路由 Cheap-First) | 变化差值 (Delta) | 统计检验 (McNemar p) / 归因性质 |
|---|---|---|---|---|
| **受处理子集胜负比 (Treated Cohort)** | N/A（未施加升级） | **1 胜 / 0 负 / 2 平** | **净胜 +1 例** | **100% 真实级联处理归因** |
| **契约合规率 (Schema Compliance)** | 90.0% (27/30) | 100.0% (30/30) | **+10.0%** | $p = 0.25$ (1 真实救回 + 2 采样噪声) |
| **分类准确率 (Category Accuracy)** | 80.0% (24/30) | 86.7% (26/30) | **+6.7%** | $p = 0.625$ (1 真实 + 2 噪声 - 1 反向) |
| **单号提取准确率 (OrderId Accuracy)** | 90.0% (27/30) | 100.0% (30/30) | **+10.0%** | $p = 0.25$ |
| **F7 动作优先权穿透率 (#27, #30)** | 100.0% | 100.0% | **+0.0% (无区分力)** | 两臂均 100% 穿透 (门禁未触发) |
| **廉价模型闭环率 (Cheap Closure)** | 100.0% | **90.0%** | 保持高闭环率 | 流量锁定在极低成本 Tier 1 |
| **强模型升级率 (Escalation Rate)** | 0.0% | **10.0%** (3/30) | 触发定向升级 | 针对困难长尾精准触发 |
| **累计 Token 消耗 (Total Tokens)** | 26,787 tokens | 48,703 tokens | **+81.8%** | 额外消耗集中于 3 例升级任务 |
| **平均端到端耗时 (Avg Latency)** | 6311ms | 5659ms | **-652ms (-10.3%)** | 落在公网 API 负载波动带内 (±25%)，不作架构性能结论 |

---

## 架构价值与深度复盘

### 1. 受处理子集真实归因与逐例剖析 (Treated Cohort Breakdown)
实验组共触发 3 例强模型定向升级，这是检验级联有效性的核心样本：
- **Case #16 (refund_polite_leisurely)**: 对照组=`err` -> 级联组=`refund` (最终接管模型: `gemini-3.1-flash-lite`, 触发原因: `cheap_budget_exhausted`)
  - 候选尝试链: [#1 gemini-3.5-flash-lite: contract_fail (合规要求：高优先级工单 (urgency ≥ 4) 的 summary)] -> [#2 gemini-3.1-flash-lite: ok]
  - 判定: **✅ 改善 (真实级联救回)**
- **Case #23 (refund_price_guarantee)**: 对照组=`refund` -> 级联组=`refund` (最终接管模型: `gemini-3.5-flash-lite`, 触发原因: `cheap_budget_exhausted`)
  - 候选尝试链: [#1 gemini-3.5-flash-lite: ok]
  - 判定: **持平 (两组皆对/皆错)**
- **Case #27 (quality_fake_product_counterfeit)**: 对照组=`refund` -> 级联组=`refund` (最终接管模型: `gemini-3.1-flash-lite`, 触发原因: `cheap_budget_exhausted`)
  - 候选尝试链: [#1 gemini-3.5-flash-lite: contract_fail (合规要求：高优先级工单 (urgency ≥ 4) 的 summary)] -> [#2 gemini-3.1-flash-lite: ok]
  - 判定: **持平 (两组皆对/皆错)**
- **净改善归因**：相比于第 1 轮（0 改善 / 2 恶化 / 1 持平），本轮在候选轮换与诊断上下文注入支持下，受处理子集实现了 **1 改善 / 0 恶化 / 2 持平**。真实救回用例（#16）经历了完整的廉价自愈失败现场诊断三元组继承与候选模型修复闭环。

### 2. 采样低抖动验证与未升级用例一致性 (Sampling Low-Jitter & Un-escalated Consistency)
- 在全量 30 个基准工单中，未触发级联升级的 27 个用例一致性达到 **85.2%** (23/27)。
- **显式不一致用例审计**：共有 4 例（#01, #07, #17, #28）在两组中输出不一致。
  - 云端托管 LLM API（如 Qwen2.5-7B）在 `temperature: 0.0` 下受动态批处理、并发调度及 MoE 路由影响，**不保证数学意义上的绝对确定性**。
  - 表观增益中存在未升级用例的采样残余抖动（2 例（#01, #17） 改善，1 例（#07） 恶化），在解读全量增益时必须予以剔除和审慎归因。
  - **中立微漂移用例（#28）**：对照组分类为 `logistics` ➔ 级联组分类为 `quality`，真实预期均为 `other`（两臂分类均未命中预期）。此漂移属于同提示词与 `temperature: 0.0` 下云端托管 LLM 采样未收敛造成的非语义性微漂移，同样证实了未升级样本在外部托管 API 存在内部状态抖动。


### 3. F7 动作优先权门禁与 Case #27 实证分析
- **门禁触发状态**：本轮评测中 `semantic_conflict_gate` 动作优先权门禁**未被触发**（本轮升级原因全部分布于 `cheap_budget_exhausted`）。
- **Case #27 与 #30 实测归因**：
  - **Case #27**：对照组分类为 `refund`，级联组分类为 `refund`（由 `gemini-3.1-flash-lite` 接管，原因: `cheap_budget_exhausted`）。两组均准确判定为 `refund`，未受假货瑕疵细节掩盖核心诉求。由于基线已有提示词动作优先权规则强化，两组结果持平（F7 穿透率 100.0%，Delta +0.0%），数据表现为稳固承接，未发生掩盖亦未触发门禁。
  - **Case #30**：对照组与级联组分类均为 `refund`，在 Tier 1 廉价模型上直接闭环，两组均准确判定。

### 4. 多候选模型轮换队列与逐候选调用归因
本轮在 3 例强模型升级中，共有 **2 例** 触发了候选队列的故障转移（Failover）：
- **Case #16**: 候选 1 (gemini-3.5-flash-lite) 状态=`contract_fail` [合规要求：高优先级工单 (urgency ≥ 4) 的 summary 至少需要 15 字] 耗时=7625ms ➔ 候选 2 (gemini-3.1-flash-lite) 状态=`ok` 耗时=3380ms
- **Case #27**: 候选 1 (gemini-3.5-flash-lite) 状态=`contract_fail` [合规要求：高优先级工单 (urgency ≥ 4) 的 summary 至少需要 15 字] 耗时=6414ms ➔ 候选 2 (gemini-3.1-flash-lite) 状态=`ok` 耗时=2901ms
实测证明：当首选模型出现 `contract_fail` 时，状态机无缝顺延至后续候选模型完成修复闭环，验证了多候选容灾池的混合保障能力。

### 5. 工程代价与成本-收益量化权衡 (Cost-Benefit Trade-offs)
- **Token 消耗**：累计 Token 增加 +81.8%（+21,916 tokens），额外开销完全集中在 3 例升级任务中，平均每例升级消耗约 **7,305 tokens**。
- **端到端耗时**：平均端到端耗时变动 **-652ms (-10.3%)**。经跨轮基线横向比对（基线在同一代码下的历史平均延迟在 3.8s–6.3s 宽幅波动，波幅达 ±25%），单轮内的毫秒级耗时差异主要受公网网络抖动与第三方 API 并发负载噪声主导，落在系统噪声带内，不作为级联路由的架构性能结论。
- **权衡决策建议**：
  - 在当前免费配额模式下，金钱成本为 **$0.00**；
  - 在商业付费生产环境下，每挽救 1 例契约崩溃任务需额外消耗约 **21,916 tokens**（单次强模型升级均值约 **7,305 tokens**）。对高价值业务单（退款纠纷、大客户工单）而言极具性价比；若面向低价值高吞吐场景，建议调小 `maxCheapRetries` 或收紧升级准入条件。

---

## Case 详细追踪明细

| Case ID | 类别 (Expected) | 对照组分类 | 级联组分类 | 最终执行模型 | 闭环与升级状态 (Status) | 候选轮换链路 (Attempts Trace) |
|---|---|---|---|---|---|---|
| #01 | `refund` | `err` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #02 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #03 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #04 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #05 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #06 | `other` | `other` | `other` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #07 | `refund` | `refund` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #08 | `logistics` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #09 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #10 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #11 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #12 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #13 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #14 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #15 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #16 | `refund` | `err` | `refund` | `gemini-3.1-flash-lite` | `cheap_budget_exhausted` | #1 gemini-3.5-flash-lite (contract_fail) ➔ #2 gemini-3.1-flash-lite (ok) |
| #17 | `refund` | `err` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #18 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #19 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #20 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #21 | `other` | `other` | `other` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #22 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #23 | `refund` | `refund` | `refund` | `gemini-3.5-flash-lite` | `cheap_budget_exhausted` | #1 gemini-3.5-flash-lite (ok) |
| #24 | `other` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #25 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #26 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #27 | `refund` | `refund` | `refund` | `gemini-3.1-flash-lite` | `cheap_budget_exhausted` | #1 gemini-3.5-flash-lite (contract_fail) ➔ #2 gemini-3.1-flash-lite (ok) |
| #28 | `other` | `logistics` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |
| #29 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 无 (廉价层闭环) |
| #30 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 无 (廉价层闭环) |

---

> **关于作者**  
> **郭强 (GuoBug)**，Product Engineer，做平台工程也做业务增长。目前主要在折腾 AI 工作流编排、DAG 状态机与确定性系统架构。  
> 开源项目与主页：[https://github.com/GuoBug](https://github.com/GuoBug) · [https://guobug.github.io](https://guobug.github.io)  
> 欢迎就工作流引擎架构、拓扑调度和低门槛开发体验交流指教。
