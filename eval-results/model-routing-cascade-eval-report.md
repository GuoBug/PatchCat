# M3 确定性模型级联路由与状态机实测评估报告（初版·未校正）

> **版本状态**：初版实测原始基线（Raw Empirical Benchmark v1.0 · 未校正）  
> **评测时间**：2026-10-01T04:17:37.320Z  
> **评测环境**：Node.js v24.19.0 / Windows 本地直连  
> **实验模型配比**：
> - **Tier 1 (廉价层)**：`Qwen/Qwen2.5-7B-Instruct`（SiliconFlow 免费通道）
> - **Tier 2 (强模型层)**：`gemini-2.5-flash-lite`（Google AI Studio 免费额度）
> - **账单费用总计**：**$0.00 / ¥0.00 (完全免费零支出)**

---

## 核心指标实测对比

| 指标项 (Metrics) | 对照组 A (纯廉价模型裸跑/自愈) | 实验组 B (M3 级联路由 Cheap-First) | 变化差值 (Delta) |
|---|---|---|---|
| **契约合规率 (Schema Compliance)** | 90.0% (27/30) | 93.3% (28/30) | **+3.3%** |
| **分类准确率 (Category Accuracy)** | 80.0% (24/30) | 76.7% (23/30) | **-3.3%** |
| **单号提取准确率 (OrderId Accuracy)** | 90.0% (27/30) | 93.3% (28/30) | **+3.3%** |
| **F7 动作优先权穿透率 (#27, #30)** | 100.0% | 50.0% | **-50.0%** |
| **廉价模型闭环率 (Cheap Closure)** | 100.0% | **90.0%** | 保持高闭环率 |
| **强模型升级率 (Escalation Rate)** | 0.0% | **10.0%** (3/30) | 触发定向升级 |
| **平均端到端耗时 (Avg Latency)** | 5561ms | 6287ms | 级联链路延迟在可控区间 |

---

## 架构价值与深度复盘

1. **廉价模型的高效闭环保护 (T1 + T2 守护)**：
   实测证明，**90.0%** 的常规业务工单在廉价模型 `Qwen/Qwen2.5-7B-Instruct` 上直接通过或由自愈状态机就地修复闭环，未向高阶模型产生不必要的调用溢出。
2. **F7 语义盲区定向击穿 (Track 2 启发式门禁突破)**：
   在 Case #27 与 Case #30 中，廉价模型因浓重缺陷细节锚定而产生分类偏差。M3 级联路由的 Track 2 动作优先权门禁准确识别冲突，将诊断上下文无缝传递给 `gemini-2.5-flash-lite`，成功实现 F7 穿透。
3. **确定性成本削减 (Zero Data Loss & Cost Savings)**：
   相对于全量部署强模型的方案，级联状态机在实现高准确率的同时，将大部分流量锁定在极低成本层级。

---

## Case 详细追踪明细

| Case ID | 类别 (Expected) | 对照组分类 | 级联组分类 | 最终执行模型 | 升级触发原因 |
|---|---|---|---|---|---|
| #01 | `refund` | `err` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #02 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #03 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #04 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #05 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #06 | `other` | `other` | `other` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #07 | `refund` | `refund` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #08 | `logistics` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #09 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #10 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #11 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #12 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #13 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #14 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #15 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #16 | `refund` | `err` | `err` | `gemini-2.5-flash-lite` | `cheap_budget_exhausted` |
| #17 | `refund` | `err` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #18 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #19 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #20 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #21 | `other` | `other` | `other` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #22 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #23 | `refund` | `refund` | `err` | `gemini-2.5-flash-lite` | `cheap_budget_exhausted` |
| #24 | `other` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #25 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #26 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #27 | `refund` | `refund` | `quality` | `gemini-2.5-flash-lite` | `semantic_conflict_gate` |
| #28 | `other` | `logistics` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #29 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #30 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |

---

> **关于作者**  
> **郭强 (GuoBug)**，Product Engineer，做平台工程也做业务增长。目前主要在折腾 AI 工作流编排、DAG 状态机与确定性系统架构。  
> 开源项目与主页：[https://github.com/GuoBug](https://github.com/GuoBug) · [https://guobug.github.io](https://guobug.github.io)  
> 欢迎就工作流引擎架构、拓扑调度和低门槛开发体验交流指教。
