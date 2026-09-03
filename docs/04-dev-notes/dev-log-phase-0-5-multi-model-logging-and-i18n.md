# 开发日志：Phase 0.5 - 多模型生态适配、三层脱敏日志与全屏设置

> **开发周期**: 2026-09-01 ~ 2026-09-02 (上午)  
> **协作者**: Guo Qiang (GuoBug) & Antigravity (AI Pair Programming)  
> **阶段定位**: 生态扩展与交互升级 (Ecosystem, Security Logging & Settings)  
> **关联文档**:  
> - [PRD-003: Dual-Mode Execution Engine Adapter](../01-prd/PRD-003-Dual-Mode-Adapter.md)  
> - [国际化 (i18n) 体系与全屏设置页面架构设计](i18n-and-settings-architecture.md)  
> - [运行前模型校验与流程仿真验证 (Preflight & Dry-Run)](preflight-model-check-and-flow-validation.md)  

---

## 1. 阶段背景与核心驱动

在 Phase 0 跑通核心画布与拓扑调度后，我们迎来了实际大模型调用阶段。此时面临几个关键的工程现实痛点：
1. **多模型协议格式分裂**：OpenAI 协议之外，国产强力模型 DeepSeek R1 具备独有的深度思考流（`<think>` / `reasoning_content`），Google Gemini 官方端点规范不同，多模型兼容是一大挑战；
2. **调试信息安全泄露风险**：开发者在调试工作流时，控制台极易直接打印出明文的 `API_KEY` 或 Bearer Token，在截图交流、录屏演示时存在巨大的安全隐患；
3. **未配置 Key 的体验断崖**：新手在尚未配置模型 Key 时如果点击“运行”，直接抛出 401 报错体验极差，需要一种“只验证数据流与连线正确性”的仿真模式。

---

## 2. 关键节点双向共创 (Milestone Co-Discovery)

| 关键决策节点 | 人类提出（产品体验与业务需求） | AI 提出（底层工程规约与系统隐患） |
| :--- | :--- | :--- |
| **多模型调用兼容** | 必须直接支持当下最火的 DeepSeek（含思维链展示）与 Google Gemini，不需要用户装代理转发。 | 指出 Google Gemini 的 `/v1beta/openai/chat/completions` 端点特征，并在前端实现**自适应端点抹平器**；针对 DeepSeek R1 设计 SSE 双轨解析器，分离 `reasoning_content` 与正文。 |
| **日志脱敏与循环引用** | 用户需要看详细日志，但导出的 JSON 或文本日志绝不能包含任何真实 API Key。 | 警告在复杂状态机中，简单的序列化会导致 `TypeError: Converting circular structure to JSON`；提出**带循环引用检测的递归对象深层掩码算法**。 |
| **未配置 Key 前置拦截** | 当没有 Key 时，不要直接报错红屏，给用户一个“先测流程逻辑”的选择。 | 提出 **Pre-flight 前置探测机制**与 **Dry-Run 仿真验证模式**，跳过网络调用，注入各节点智能 Mock 响应，验证拓扑流转。 |
| **轻量国际化 (i18n)** | 既要有中文友好度，也要支持全球开源英文社区。 | 拒绝引入体积庞大、依赖复杂的第三方 i18n 框架；通过纯 TypeScript 泛型接口定义严格强类型的翻译模式，零运行时体积负担。 |

---

## 3. 核心功能落地实现

### 3.1 跨服务商 LLM 客户端与 SSE 流式解析器 (`src/engine/llm-client.ts`)
- **端点自动规约**：自动识别 Google Gemini、DeepSeek 与通用 OpenAI 兼容地址，修正缺少 `/v1` 或斜杠的边缘情况；
- **分段 SSE 流解析**：利用正则与分包缓冲（Buffer），在网络数据包拆分情况下稳定拼接 SSE 消息行；
- **DeepSeek 思考链支持**：在右侧抽屉提供【思维推理过程】折叠卡片，实时呈现大模型思考流。

### 3.2 三层脱敏日志引擎 (`src/engine/logger.ts`)
- **三层日志分级过滤**：
  - `Summary`（高层业务概览：波次开始、整体耗时、成败汇总）；
  - `Detailed`（节点级生命周期：单个节点入参出参摘要、Token 消耗）；
  - `Dev`（底层调试级别：完整 Payload 报文、底层网络事件）。
- **递归正则掩码**：自动检测 `sk-...`、`AIza...`、`Bearer ...` 及名为 `apiKey`、`authorization` 的键值，自动替换为掩码星号，并防御对象循环嵌套。

### 3.3 全屏设置中心与语言切换 (`src/components/panels/SettingsPage.tsx`)
- 替代局促的弹出卡片，采用现代独立全屏页面管理服务商配置；
- 支持实时拉取服务商可用模型列表（`availableModels`）；
- 中英双语切换即刻生效，连同所有预设工作流（Customer Support, Code Review, Arbitrator）一同双语本地化。

### 3.4 前置预检与 Dry-Run 仿真验证 (`src/components/panels/ControlHeader.tsx`)
- 在点击“运行”瞬间执行前置拦截探测：若检测到图谱中包含 LLM 节点且未配置 Key，弹出友好引导弹窗；
- 提供【仅进行流程校验】选项（`skipLLM: true`），使整个工作流在完全零配置 Key 状态下完成波次流转与数据消费验证。

---

## 4. 验证与测试保障
- 编写 `tests/llm-client.node.test.ts`：端点规约校验、流式分包合并验证、401/503 错误分类测试；
- 编写 `tests/logger.node.test.ts`：三层日志过滤、Key 敏感字符脱敏、循环引用安全检测；
- 编写 `tests/settings.node.test.ts`：模型拉取、配置持久化与视图导航测试。
- 全量自动化测试 **100% 保持通过**。
