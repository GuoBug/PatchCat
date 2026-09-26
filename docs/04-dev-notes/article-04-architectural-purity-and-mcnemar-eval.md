# 边写边学 AI 工作流引擎（四）：架构纯度清洗与 42 样本统计检验复盘

> 导读：在前面的三篇迭代中，我们依次搭建了 L1 物理受限解码、L2 业务契约校验、L3 三元组自愈状态机，以及 L4 Never-Throw 终极兜底防线。测试全部通过，可视化画布运行顺畅。但进入阶段复盘时，两个关键设计决策浮出水面：一是引擎核心代码是否被特定工单业务污染，二是自愈状态机声称的 23.9% 合规率提升是否存在幸存者偏差。本篇作为 Module 0 的总结，记录我们如何完成架构解耦与双口径 McNemar 统计检验，给系统交出一份经得起推敲的工程答卷。

---

> 项目开源地址：[https://github.com/GuoBug/PatchCat](https://github.com/GuoBug/PatchCat)  
> 在线体验：[https://guobug.github.io/PatchCat/](https://guobug.github.io/PatchCat/)  
> 系列往期索引：  
> 📖 [《边写边学 AI 工作流引擎（一）：搞 Eval 评测前，先让输出闭合！结构化约束与业务契约防线》](./article-01-structured-output-eval-prerequisite.md)  
> 📖 [《边写边学 AI 工作流引擎（二）：告别“无脑重试” —— L3 自愈状态机与三元组纠错机制》](./article-02-beyond-naive-retries-self-healing-state-machine.md)  
> 📖 [《边写边学 AI 工作流引擎（三）：真实踩坑复盘 —— Case #7 的字段冻结陷阱与代码回滚》](./article-03-case-7-field-freezing-trap-and-rollback.md)

---

![架构纯度清洗与 42 样本统计检验复盘](../assets/architectural-purity-mcnemar-cover.jpg)

---

## 一、功能全跑通了，为什么还不能算“完成”？

在开发开源项目 [PatchCat](https://github.com/GuoBug/PatchCat) 的过程中，我们始终遵循边写边学（Learning by Doing）的人机协同模式（AI Pair Programming）。当我们把防御网与自愈状态机跑通、329 项测试绿灯通过时，代码看似已经具备交付条件。

但在推进到核心工程节点的复盘讨论时，我和 AI 结对伙伴对系统的可用性与评估依据提出了两项质疑：

### 1. 节点复盘：业务语义下沉与引擎纯度边界
作为 Product Engineer，我对 PatchCat 的定位是通用的 **AI 工作流编排**（AI Workflow Orchestration）底座。在规划后续支持法律合同审查、简历结构化解析等跨行业场景时，我发现了一个关键痛点：如果下游业务想跑一份全新的数据流，难道还需要去改动引擎底层源码？  
AI 伙伴在 Review `src/engine/structured-output.ts` 时也指出了同样的异味：文件里硬编码着 `TicketSemanticSchema`（工单、退款、物流）以及 130 行业务场景。代码虽已跑通，但职责分层发生了越界。

### 2. 节点复盘：工程收益归因与严谨统计检验
自愈状态机上线后，控制台数据显示端到端合规率提升了 23.9%。我要求对外发布前必须给出具备统计效力的评估依据，拒绝用零星几张修复成功的截图来做宣传。  
AI 伙伴提出：评估成对二值数据（通过/失败）必须采用匹配样本的假设检验。同时需要拆分 By-Sample（按采样样本）与 By-Case（按独立用例）两个口径，检验收益是全局普惠还是集中在个别用例。

这两个关键节点的推导让我们达成共识：一个可靠的 **确定性工作流** 引擎，必须经历架构纯度与统计科学的两场彻底清洗。

---

## 二、第一道清洗：业务逻辑下沉与契约注册中心解耦

在模块搭建初期，为了快速验证自愈逻辑，智能工单的业务 Schema 被临时写进了引擎核心文件：

```typescript
// ❌ 业务下沉污染：引擎核心感知了具体的业务形态
// 位于 src/engine/structured-output.ts (重构前)
export const TicketSemanticSchema = z.object({
  category: z.enum(['refund', 'logistics', 'complaint', 'other']),
  urgency: z.number().int().min(1).max(5),
  orderId: z.string().optional(),
  // ...以及整整 130 行业务测试场景 TEST_SCENARIOS
});
```

### 1. 试金石法则：引擎不感知业务语义
我们确立了一条明确的设计红线：

> *核心设计契约：引擎负责契约的执行、调度与状态转移，不定义任何具体的业务语义。拿引擎去跑任何全新领域（如合同审查、医疗问答），若需改动引擎核心代码，即为分层失职。*

`src/engine/` 属于纯粹的流程调度底座；而“工单分发”、“合同审查”属于上层业务预设，必须全部收敛在 `src/presets/`。

### 2. 引入领域中立的契约注册中心（Schema Registry）
为了彻底剥离硬编码，我们在引擎层设计了轻量级的 Schema Registry：

```typescript
// ✅ 引擎层抽象：完全领域中立的 Schema 注册中心
// 位于 src/engine/structured-output.ts
const schemaRegistry = new Map<string, z.ZodTypeAny>();

export function registerSchema<T extends z.ZodTypeAny>(name: string, schema: T): void {
  schemaRegistry.set(name, schema);
}

export function getSchema(name: string): z.ZodTypeAny | undefined {
  return schemaRegistry.get(name);
}
```

### 3. 解耦实施与代价权衡
随后我们完成了分层剥离：
1. 外迁业务配置：将 `TicketSemanticSchema` 与 130 行工单场景完整移出引擎，归档至 `src/presets/self-healing-scenarios.ts`；
2. 纯化引擎引用：`src/engine/structured-output.ts` 移除所有 `orderId`、`refund` 等具体业务字段，统一依赖 `z.ZodTypeAny` 与外部传入的配置；
3. 测试用例重构：测试套件通过 `import { ... } from '../presets/self-healing-scenarios'` 注入用例，保持引擎与测试数据的边界分明。

工程方案必然伴随代价：动态注册机制（`schemaRegistry.get(name)`）返回的是 `z.ZodTypeAny`，在编译期失去了静态类型联想，调用方必须通过泛型或显式断言来恢复类型。但对于需要动态加载预设模板的编排系统而言，这一类型灵活性的代价是值得的。

---

## 三、第二道清洗：42 样本双口径 McNemar 检验与数据复盘

架构剥离后，我们对自愈状态机开展了基准对照实验。

### 1. 实验设计与环境约束
- 测试基座模型：选用硅基流动平台托管的 `Qwen/Qwen2.5-7B-Instruct`。选择小参数量开源模型，是为了更直观地暴露格式损坏与逻辑冲突，检验防御边界；
- 样本设计：选取 14 个彼此独立的业务场景（覆盖枚举越界、文本截断、跨字段冲突、空响应等），每个场景独立采样 3 轮，总计采集 42 组配对样本；
- 对照组设计：
  - Baseline（基线）：仅开启 L1 受限解码；
  - Self-Healing（实验组）：开启 L1 物理防御 + L2 契约守卫 + L3 三元组自愈状态机。

### 2. 双口径数据呈现
针对成对二值（Pass / Fail）数据，我们采用 **麦克尼马尔配对卡方检验（McNemar's Exact Test）** 进行统计显著性分析：

| 统计检验口径 | 样本规模 | Baseline 合规率 | Self-Healing 合规率 | 净增益 | McNemar 精确检验 $p$ 值 | 统计学结论 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **By-Sample（按样本配对）** | $n = 42$ | 69.0% (29/42) | 92.9% (39/42) | +23.9% | $p = 0.00195$ | 极显著差异 ($p < 0.01$) |
| **By-Case（按独立用例）** | $N = 14$ | 78.6% (11/14) | 100.0% (14/14) | +21.4% | $p = 0.125$ | 未达显著水平 ($p > 0.05$) |

在 By-Sample 口径下达到了极显著差异（$p = 0.00195$），但在 By-Case 口径下却显示未达显著水平（$p = 0.125$）。这一分歧揭示了实验的真实机制。

### 3. 数据分歧背后的工程真相

#### 归因一：收益集中在少数极端边界用例
在 42 组样本对应的 2×2 列联表中：
- 两组均通过（$a$）：29 组；
- Baseline 失败而 Self-Healing 修复成功（$b$）：10 组；
- Baseline 通过而 Self-Healing 翻车退步（$c$）：0 组；
- 两组均失败（$d$）：3 组（重试耗尽的极端截断用例）。

双侧二项检验公式计算不一致对的概率：$P = 2 \times (0.5)^{10} \approx 0.00195$。  
而在 By-Case 口径下，总用例数仅有 14 个。11 个常规用例在 Baseline 下就能通过，真正发生修复的只有 3 个极端用例（Case #7 跨字段联动、Case #3 数值越界、Case #5 枚举违规）。从统计学自由度来看，用例基数过小导致 $p = 0.125 > 0.05$，无法在用例级别直接拒绝原假设。

自愈状态机并不是让所有常规用例平均提升，而是定点兜底了那些容易导致整条链路崩溃的极端边界用例。同时这也表明当前测试集的局限：14 个用例的覆盖面有限，未来需要将评测集扩充至上百个独立维度。

#### 归因二：首轮业务违规从 8 次上升到 13 次的原因
分析 Trace 日志时发现了一个反直觉的现象：实验组在首轮输出时的业务违规次数比基线组还要多（8 次升至 13 次）。

这并不意味着受限解码降低了模型智商：
1. Baseline 下遇到复杂输入时，经常直接发生 JSON 语法截断或括号不全，在 `JSON.parse` 阶段就抛出 `SyntaxError` 崩溃。这些样本连业务校验器都未进入；
2. 引入 L1 受限解码后，底层的语法崩溃从 3 次降为 0 次。大模型能输出完整的 JSON 骨架后，隐藏在底层的跨字段业务违规才正式暴露在 L2 校验器面前；
3. 端到端合规率最终由 69.0% 提升至 92.9%，净增益来自 L3 自愈状态机对这些暴露错误的针对性纠正，并非模型首轮输出质量自发改善。

---

## 四、确定性架构全貌：Module 0 分层防御图谱

经过前四篇的迭代、踩坑与回滚，我们为 PatchCat 构建了分层防御体系：

![Module 0 确定性结构化输出与分层防御全景图谱](../assets/flowchart-module-0-full-defense-architecture.svg)

- L1 负责物理语法：通过受限解码与协商机制统一各厂商接口行为，保障 JSON 语法闭合；
- L2 负责业务契约：以 Zod 作为单一事实来源，拦截数值越界与逻辑冲突；
- L3 负责定向自愈：结合三元组反馈在上下文语义中完成修正；
- L4 负责确定性托底：借助 Never-Throw 规范防止运行中断，保障下游 **DAG 状态机** 能基于 Kahn 拓扑排序完成节点分流；
- 架构纯度与严谨评测：通过 Schema Registry 保持领域中立，配合 McNemar 统计检验量化系统真实边界。

---

## 五、给 Product Engineer 的工程思考

在 AI 原生应用逐渐普及的背景下，兼顾底层工程与业务落地需要把握几个实际原则：

1. 警惕黑盒参数，重视契约边界  
   过度依赖单一大模型的私有参数往往会在多厂商切换时遭遇兼容问题。只有将状态机、语法修复与契约校验沉淀在自己的控制层，系统才具备跨模型运行的韧性。

2. 承认数据局限，坦承工程取舍  
   在技术宣传中给出夸大的数字很容易，但真实的工程研发需要直面样本规模的局限。诚实说明 $p = 0.125$ 的统计成因，不仅不会降低系统的可信度，反而能清晰标定防御机制生效的前提条件。

至此，关于确定性结构化输出与自愈状态机的探讨告一段落。后续我们将继续聚焦在 DAG 拓扑调度优化与复杂分支控制等更深层次的编排机制上。

欢迎社区同行与开发者参与 Review，共同探讨工作流引擎的设计与落地。

---

> **关于作者**  
> **郭强 (GuoBug)**，Product Engineer，做平台工程也做业务增长。目前主要在折腾 AI 工作流编排、DAG 状态机与确定性系统架构。  
> 开源项目与主页：[https://github.com/GuoBug](https://github.com/GuoBug) · [https://guobug.github.io](https://guobug.github.io)  
> 欢迎就工作流引擎架构、拓扑调度和低门槛开发体验交流指教。
