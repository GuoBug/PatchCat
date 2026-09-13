# Dev Log (Phase 3 - Part 1): 条件分支路由、Kahn 图剪枝与 HTTP 节点实战

> **版本归属**: `v0.3.0`  
> **关联阶段**: Phase 3 Conditional Routing & Dynamic Branch Skipping  
> **发布日期**: 2026-09-09  

---

## 1. 核心架构跃迁概述

在 v0.3.0 中，PatchCat 完成了从“单向线性流水线”向“图灵完备图控制流”的核心跃迁：
1. **条件分支节点 (`ConditionNode.tsx`)**：支持 9 大逻辑评估算子（`equals`, `not_equals`, `contains`, `not_contains`, `greater_than`, `less_than`, `is_empty`, `is_not_empty`, `regex_match`）。
2. **Kahn 拓扑排序中的动态分支剪枝 (`browser-engine.ts`)**：保持分层波次结构稳定，运行时自上而下广播 `skipped` 标记并触发 `NODE_SKIPPED` 事件，彻底避免分支未命中导致的拓扑死锁。
3. **变量聚合器 (`AggregatorNode.tsx`)**：以“至少一条活跃输入即可激活”契约反转普通节点全量就绪依赖，提供 `first_available`、`merge_all`、`wait_all` 三种合流模式，打破分支汇聚死锁。
4. **HTTP 弹性请求节点 (`HttpNode.tsx`)**：提供全方法支持、协议安全白名单校验（防御 `file://` 等伪协议注入）以及基于几何级数的 5xx 指数退避重试机制。

---

## 2. 关键代码实现锚点

- **条件评估器**: `src/engine/browser-engine.ts` -> `evaluateCondition()`
- **分支跳过逻辑**: `src/engine/browser-engine.ts` -> `layerExecutionPromise` 中的 `shouldSkip` 与 `skippedNodes` 收集
- **聚合器求值**: `src/engine/browser-engine.ts` -> `case 'aggregator'`
- **HTTP 弹性执行**: `src/engine/browser-engine.ts` -> `case 'http'`
- **测试覆盖**: `tests/condition-aggregator.node.test.ts` 与 `tests/http-node.node.test.ts` (共 94 个前端单元测试 100% 通过)
