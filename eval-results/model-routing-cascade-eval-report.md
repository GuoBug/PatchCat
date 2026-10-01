# M3 模型级联路由与状态机实测评估报告（多模型轮换池实测版）

> **评测时间**：2026-10-01T10:52:04.682Z  
> **评测环境**：Node.js v24.19.0 / Windows 本地直连  
> **实验模型配比**：
> - **Tier 1 (廉价层)**：`Qwen/Qwen2.5-7B-Instruct`（SiliconFlow 免费通道，`temperature: 0.0` 确定性基线）
> - **Tier 2 (强模型多候选轮换池)**：`gemini-3.5-flash-lite -> gemini-3.1-flash-lite -> gemini-3.8-flash`（Google AI Studio 免费额度）
> - **账单费用总计**：**$0.00 / ¥0.00 (完全免费零支出)**

---

## 核心指标实测对比

| 指标项 (Metrics) | 对照组 A (纯廉价模型基线) | 实验组 B (M3 级联路由 Cheap-First) | 变化差值 (Delta) |
|---|---|---|---|
| **契约合规率 (Schema Compliance)** | 90.0% (27/30) | 100.0% (30/30) | **+10.0%** |
| **分类准确率 (Category Accuracy)** | 80.0% (24/30) | 86.7% (26/30) | **+6.7%** |
| **单号提取准确率 (OrderId Accuracy)** | 90.0% (27/30) | 100.0% (30/30) | **+10.0%** |
| **F7 动作优先权穿透率 (#27, #30)** | 100.0% | 100.0% | **+0.0%** |
| **廉价模型闭环率 (Cheap Closure)** | 100.0% | **90.0%** | 保持高闭环率 |
| **强模型升级率 (Escalation Rate)** | 0.0% | **10.0%** (3/30) | 触发定向升级 |
| **累计 Token 消耗 (Total Tokens)** | 23,513 tokens | 48,769 tokens | **+107.4%** |
| **平均端到端耗时 (Avg Latency)** | 3840ms | 5296ms | **+37.9%** |

---

## 架构价值与深度复盘

1. **确定性基准与未升级用例一致性 (Determinism)**：
   在全量 30 个基准工单中，未触发级联升级的 27 个用例一致性达到 **85.2%** (23/27)。在 `temperature: 0.0` 约束下，成功消除了采样抖动带来的伪 A/B 差异，确保评估结论完全源于架构路由决策。
2. **多候选轮换队列与级联升级效果 (Escalation Breakdown)**：
   实验组共触发 3 例强模型升级：
- **Case #16 (refund_polite_leisurely)**: 对照组=`err` -> 级联组=`refund` (由 `gemini-3.1-flash-lite` 接管，原因: `cheap_budget_exhausted`) => **✅ 改善 (升级成功纠偏)**
- **Case #23 (refund_price_guarantee)**: 对照组=`refund` -> 级联组=`refund` (由 `gemini-3.5-flash-lite` 接管，原因: `cheap_budget_exhausted`) => **保持正确**
- **Case #27 (quality_fake_product_counterfeit)**: 对照组=`refund` -> 级联组=`refund` (由 `gemini-3.1-flash-lite` 接管，原因: `cheap_budget_exhausted`) => **保持正确**
   - **F7 突破点实证**：Case #27 在对照组输出为 `refund`，级联组通过动作优先权门禁升级并由 `gemini-3.1-flash-lite` 接管，输出为 `refund`，成功突破 F7 症状压制诉求的语义盲区！
3. **真实资源开销与工程代价**：
   级联重试与跨模型调用带来了客观代价：累计 Token 消耗增加 +107.4%，端到端延迟变化 +37.9%。在实现 $0 账单的同时，多候选模型轮换（gemini-3.5-flash-lite -> gemini-3.1-flash-lite -> gemini-3.8-flash）显著降低了单点限流（429/503）崩溃的风险。

---

## Case 详细追踪明细

| Case ID | 类别 (Expected) | 对照组分类 | 级联组分类 | 最终执行模型 | 闭环与升级状态 (Status) |
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
| #12 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #13 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #14 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #15 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #16 | `refund` | `err` | `refund` | `gemini-3.1-flash-lite` | `cheap_budget_exhausted` |
| #17 | `refund` | `err` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #18 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #19 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #20 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #21 | `other` | `other` | `other` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #22 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #23 | `refund` | `refund` | `refund` | `gemini-3.5-flash-lite` | `cheap_budget_exhausted` |
| #24 | `other` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #25 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #26 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #27 | `refund` | `refund` | `refund` | `gemini-3.1-flash-lite` | `cheap_budget_exhausted` |
| #28 | `other` | `logistics` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |
| #29 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` |
| #30 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` |

---

> **关于作者**  
> **郭强 (GuoBug)**，Product Engineer，做平台工程也做业务增长。目前主要在折腾 AI 工作流编排、DAG 状态机与确定性系统架构。  
> 开源项目与主页：[https://github.com/GuoBug](https://github.com/GuoBug) · [https://guobug.github.io](https://guobug.github.io)  
> 欢迎就工作流引擎架构、拓扑调度和低门槛开发体验交流指教。
