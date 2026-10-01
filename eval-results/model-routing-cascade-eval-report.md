# M3 模型级联路由与状态机实测评估报告（初版·已校正）

> **版本状态**：初版实测数据重审与归因校正版（Empirical Benchmark v1.1 · Audited & Calibrated）  
> **评测时间**：2026-10-01T04:17:37.320Z（审核复核：2026-10-01）  
> **评测环境**：Node.js v24.19.0 / Windows 本地直连  
> **实验模型配比**：
> - **Tier 1 (廉价层)**：`Qwen/Qwen2.5-7B-Instruct`（SiliconFlow 免费通道）
> - **Tier 2 (强模型层)**：`gemini-2.5-flash-lite`（Google AI Studio 免费额度）
> - **账单费用总计**：**$0.00 / ¥0.00 (完全免费零支出)**

---

## 核心指标实测对比

| 指标项 (Metrics) | 对照组 A (纯廉价模型基线) | 实验组 B (M3 级联路由 Cheap-First) | 变化差值 (Delta) | 统计与工程归因 |
|---|---|---|---|---|
| **契约合规率 (Schema Compliance)** | 90.0% (27/30) | 93.3% (28/30) | **+3.3%** | 采样噪声（McNemar $p=1.0000$） |
| **分类准确率 (Category Accuracy)** | 80.0% (24/30) | 76.7% (23/30) | **-3.3%** | 采样噪声（McNemar $p=1.0000$） |
| **单号提取准确率 (OrderId Accuracy)** | 90.0% (27/30) | 93.3% (28/30) | **+3.3%** | 采样噪声（McNemar $p=1.0000$） |
| **F7 动作优先权穿透率 (#27, #30)** | 100.0% | 50.0% | **-50.0%** | **确凿回归**：强模型未遵从消歧指令 |
| **廉价模型闭环率 (Cheap Closure)** | 100.0% | **90.0%** | -10.0% | 保持 90% 流量锁定在经济层 |
| **强模型升级率 (Escalation Rate)** | 0.0% | **10.0%** (3/30) | +10.0% | 真实触发升级子集 $n=3$ |
| **累计 Token 消耗 (Total Tokens)** | 26,042 tokens | 39,695 tokens | **+52.4%** | 重试与级联上下文携带的确定性开销 |
| **平均端到端耗时 (Avg Latency)** | 5,561ms | 6,287ms | **+13.1%** | 跨模型调度网络往返延迟 |

---

## 架构价值与白盒审计复盘

本报告基于全量原始测试日志（`eval-results/model-routing-benchmark-2026-10-01T04-17-37-319Z.json`）展开白盒复核。秉持“研究模式求真不糊弄”的工程原则，剥离表象指标，对级联路由机制的真实表现进行归因重构：

### 1. 真实受试子集分析（$n=3$：0 改善 / 2 恶化 / 1 持平）
在全量 30 个基准用例中，有 **27 个用例（90%）在两组中均由同一个廉价模型（Qwen2.5-7B）处理闭环**。在这 27 个未发生模型升级的用例上：
- #01 与 #17 从失败翻转为成功，#07 从成功翻转为失败；
- 两组采用相同模型、相同提示词与 $T=0.1$ 参数，此等相反结果纯属**非确定性采样波动**；
- 经 McNemar 精确检验，指标差异的统计显著性均为 $p = 1.0000$，全篇声明的 $\pm 3.3\%$ 宏观波动全部落在抽样噪声区间内。

真正产生级联路由干预的受试子集仅有 3 例（#16、#23、#27），其实测处置效果如下：
- **Case #16（`cheap_budget_exhausted`）**：廉价模型重试耗尽后升级至 Gemini，但 Gemini 依然未能产出合规契约，最终以首轮廉价输出兜底（**持平**）；
- **Case #23（`cheap_budget_exhausted`）**：对照组廉价模型首轮侥幸闭环（`refund`），级联组廉价模型重试失败后触发升级，Gemini 亦未能修复（**恶化**）；
- **Case #27（`semantic_conflict_gate`）**：对照组廉价模型命中 `refund`，级联组廉价模型首轮契约通过但命中门禁触发升级；然而 Gemini 受工单假货瑕疵细节锚定，忽略消歧指令仍判为 `quality`（**恶化**）。

**结论**：在本次实测中，级联路由在真正被处理的子集上净收益为负。初版报告中将抽样波动归为级联收益的结论已被正式废除。

### 2. F7 动作优先权门禁病理解剖（由 100% 降至 50%）
初版报告声称“成功实现 F7 穿透”，经严格审计核实属于严重误判：
- **Case #30**：全程闭环于经济模型（`cheap_self_healing`），门禁根本未对该用例触发升级，不可记为路由战果；
- **Case #27**：语义门禁准确拦截了廉价模型的偏向，但在将诊断上下文传递给 Tier 2 强模型时，即便注入了强约束消歧指令（`请务必以用户最终诉求动作作为第一判据，优先归类为 refund！`），轻量级强模型（`gemini-2.5-flash-lite`）依然强力锚定于密集的“假冒伪劣”、“做工粗糙”等属性词，输出 `quality`。
- **病理机理**：轻量推理模型的自注意力机制容易被高密度的负向描述特征劫持，单轮 Prompt 级消歧指令不足以打破其预训练注意力倾向。门禁机制反而将原本由于近因效应侥幸答对的结果“固化纠偏为错误”。

### 3. 真实系统代价（算力与延迟开销）
级联路由与状态机自愈并非免费午餐：
- **算力开销**：由于升级时需执行上下文携带（Context Carry-Over）并包含前序失败诊断现场，总 Token 开销由 26,042 跃升至 39,695，增加 **+52.4%**；
- **响应延迟**：跨网络多模型调用使端到端平均延迟从 5,561ms 增加至 6,287ms（**+13.1%**）。

### 4. 架构缺陷整改与单变量公平性固化
根据审核组建议，已在代码层面完成两项核心整改：
1. **解除领域逻辑对通用引擎的侵入（P1-1 修复）**：原 `detectSemanticConflict` 中硬编码的电商词表已完全剥离出通用引擎 `src/engine/model-router.ts`，沉淀为独立的业务预设 `src/presets/ticket-semantic-gate.ts`。引擎侧仅保留抽象接口 `ISemanticConflictGate`，恪守“引擎认接口，preset 认业务”的设计契约。
2. **基线自愈提示词公平性对齐（P0-4 修复）**：修复了基线路径中 `runSingleTierLoop` 在重试时丢失 `{ jsonSchema, goldenExemplar }` 的缺陷，消除了因提示词丰度不对称引发的混淆变量。

---

## Case 详细追踪明细

| Case ID | 类别 (Expected) | 对照组分类 | 级联组分类 | 最终执行模型 | 闭环与升级状态 (Status) | 差异归因 |
|---|---|---|---|---|---|---|
| #01 | `refund` | `err` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 采样噪声（同模型两次执行） |
| #02 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 一致通过 |
| #03 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 一致通过 |
| #04 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 一致通过 |
| #05 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 一致通过 |
| #06 | `other` | `other` | `other` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 一致通过 |
| #07 | `refund` | `refund` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 采样噪声（同模型两次执行） |
| #08 | `logistics` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 一致误判 |
| #09 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 一致通过 |
| #10 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 一致通过 |
| #11 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 一致通过 |
| #12 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 一致通过 |
| #13 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 一致通过 |
| #14 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 一致通过 |
| #15 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 一致通过 |
| #16 | `refund` | `err` | `err` | `gemini-2.5-flash-lite` | `cheap_budget_exhausted` | 真实级联：强模型亦未合规（持平） |
| #17 | `refund` | `err` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 采样噪声（同模型两次执行） |
| #18 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 一致通过 |
| #19 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 一致通过 |
| #20 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 一致通过 |
| #21 | `other` | `other` | `other` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 一致通过 |
| #22 | `quality` | `quality` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 一致通过 |
| #23 | `refund` | `refund` | `err` | `gemini-2.5-flash-lite` | `cheap_budget_exhausted` | 真实级联：强模型未救回（恶化） |
| #24 | `other` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 一致误判 |
| #25 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 一致通过 |
| #26 | `logistics` | `logistics` | `logistics` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 一致通过 |
| #27 | `refund` | `refund` | `quality` | `gemini-2.5-flash-lite` | `semantic_conflict_gate` | 真实级联：强模型被假货词锚定（恶化） |
| #28 | `other` | `logistics` | `quality` | `Qwen/Qwen2.5-7B-Instruct` | `primary_default` | 采样噪声（两组均未命中 expected） |
| #29 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 一致通过 |
| #30 | `refund` | `refund` | `refund` | `Qwen/Qwen2.5-7B-Instruct` | `cheap_self_healing` | 未触发升级（廉价自愈闭环） |

---

## 下一步迭代行动项 (Roadmap)

1. **确定性温度基线测试**：将评测环境切换为 `temperature: 0.0`，消除同模型非确定性采样翻转，建立绝对可复现的基线；
2. **Few-shot 强引导升级机制**：针对 F7 类用例，在向 Tier 2 强模型升级时，不再单纯拼接一段系统指令，而是动态注入 1~2 个正反样例（Few-shot Exemplar），从注意力机制根源化解属性词强锚定；
3. **分层置信度仲裁**：当强模型返回的分类与门禁意图冲突时，引入二次校验仲裁或回退策略，避免把原本正确的用例“固化纠正为错误”。

---

> **关于作者**  
> **郭强 (GuoBug)**，Product Engineer，做平台工程也做业务增长。目前主要在折腾 AI 工作流编排、DAG 状态机与确定性系统架构。  
> 开源项目与主页：[https://github.com/GuoBug](https://github.com/GuoBug) · [https://guobug.github.io](https://guobug.github.io)  
> 欢迎就工作流引擎架构、拓扑调度和低门槛开发体验交流指教。
