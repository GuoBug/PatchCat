# PatchCat 研发手记与《边写边学 AI 工作流引擎》专栏底册

本目录收录 PatchCat（端侧与浏览器原生确定性 AI 工作流编排引擎）的全部核心架构决策记录（ADR）、系统演进开发日志（Dev Logs）以及开源复盘专栏《边写边学 AI 工作流引擎》全套专著文章。

---

## 专栏系列：《边写边学 AI 工作流引擎》

| 篇目 | 标题 | 核心主题与突破点 |
| :--- | :--- | :--- |
| **01** | [搞 Eval 评测前，先让输出闭合！结构化约束与业务契约防线](./article-01-structured-output-eval-prerequisite.md) | JSON Schema 受限解码、Zod 运行时校验、业务契约第一道防线 |
| **02** | [告别“无脑重试” —— L3 自愈状态机与三元组纠错机制](./article-02-beyond-naive-retries-self-healing-state-machine.md) | 同构重试陷阱、三元组（Raw Output + Schema + Diagnostic Errors）白盒反馈与状态转移 |
| **03** | [真实踩坑复盘 —— Case #7 的字段冻结陷阱与代码回滚](./article-03-case-7-field-freezing-trap-and-rollback.md) | 局部最优陷阱、满意解不等于正确解、勇敢回滚与版本控制纪律 |
| **04** | [架构纯度清洗与 42 样本统计检验复盘](./article-04-architectural-purity-and-mcnemar-eval.md) | 业务逻辑与核心引擎严格解耦、McNemar 配对卡方统计检验、指标可信度 |
| **05** | [合规率暴涨 23.9%，语义准确率却跌了 7.1%？自愈病理学与双轴归因复盘](./article-05-eval-error-analysis-taxonomy.md) | 格式合规掩盖语义退化（F6）、自愈病理学分类法、双轴归因矩阵 |
| **06** | [用一次“假药对照”，我们在大模型自愈中抓出了真凶](./article-06-placebo-control-and-empirical-closure.md) | 安慰剂组（Placebo Control）单变量隔离实验、不动点卡死 vs. 动态振荡机制 |
| **07** | [告别“有进无出的上下文黑洞” —— 双锚点滑动窗口与原子事务裁剪实战](./article-07-context-engineering-dual-anchor-pruning.md) | 上下文工程三层防御、双锚点前缀缓存优化、协议原子事务完整性、$O(K)$ 滑动窗口 |
| **08** | [失败了别全盘重来！逆向 BFS 拓扑回溯与 DAG 检查点断点续跑](./article-08-resumable-dag-checkpoint-and-reverse-bfs.md) | 逆向依赖图遍历、自适应向上扩充、菱形依赖空洞化解、5-Record FIFO 存储防线 |
| **09** | [别让 Agent 原地鬼打墙！连续 3 次相同工具调用的柔性引导与硬熔断](./article-09-agent-deadlock-and-circuit-breaker.md) | 参数签名比对算法、连续第 2 次柔性引导提示、第 3 次看门狗硬熔断、Token 预算双重锁 |

---

## 核心架构决策记录 (Architecture Decision Records, ADR)

* [**ADR-001: Canvas Engine Selection**](./adr-001-canvas-engine-selection.md) —— 画布引擎选型评估（React Flow / XYFlow vs. 其他图可视化库）
* [**ADR-002: Dual-Engine Architecture**](./adr-002-dual-engine-architecture.md) —— 端侧浏览器引擎与服务端引擎的同构解耦契约
* [**ADR-003: 确定性执行架构抉择**](./adr-003-event-sourcing-vs-checkpointing-and-local-first-lessons.md) —— Event Sourcing vs. Checkpointing 深度辩证与 Linux 组合哲学落地
* [**ADR-004: 上下文工程阈值基准与双锚点滑动裁剪架构**](./adr-004-context-engineering-thresholds-and-pruning.md) —— 破除魔法数字：$K=4$、4,000 字符、60/40 首尾保留与 0.75 水位线深度论证
* [**ADR-005: 确定性模型级联路由与自愈升级状态机架构**](./adr-005-deterministic-model-routing-and-cascade-state-machine.md) —— Cheap-First 级联分层：87.5% 成本压缩、自愈耗尽升级阈值与 F7 动作优先权双轨门禁

---

## 阶段开发日志与技术白皮书 (Engineering Logs & Whitepapers)

* [**阶段架构加固与技术债务重构复盘**](./dev-log-architecture-hardening-and-debt-refactor.md)
* [**Phase 4.10: 不可变检查点快照与可断点续跑 DAG**](./dev-log-phase-4-10-immutable-checkpointing-and-resumable-dag.md)
* [**Phase 4.11: 存储加固与瞬态流内存隔离**](./dev-log-phase-4-11-storage-hardening-and-ephemeral-stream.md)
* [**Phase 4.12: 确定性结构化输出与自愈状态机**](./dev-log-phase-4-12-deterministic-structured-output-and-self-healing.md)
* [**工程测试覆盖率与运行时性能基准**](./engineering-test-coverage-and-runtime-benchmarks.md)
* [**PatchCat 用户交互手册与组件使用指南**](./user-manual-and-component-guide.md)
