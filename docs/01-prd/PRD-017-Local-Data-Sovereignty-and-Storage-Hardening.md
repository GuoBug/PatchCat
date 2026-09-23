---
title: "PRD-017: Local Data Sovereignty, Web Crypto Vault & Storage Hardening"
version: "v0.4.11"
status: "Draft / Ready for Implementation 📋"
author: "郭强 (GuoBug) & PatchCat Architecture Team"
created: "2026-09-23"
updated: "2026-09-23"
milestone: "Phase 4.11 (v0.4.11) & Phase 4.13 (v0.4.13)"
tags: ["Local-First", "Web Crypto API", "Storage Hardening", "Sanitization", "Linux Philosophy", "ADR-003"]
---

# PRD-017: 端侧数据主权、Web Crypto 本地暗室与存储防膨胀治理

[English Version](#english-version) | [中文版本](#中文版本)

---

<a name="中文版本"></a>
## 中文版本

### 1. 业务背景与设计动机 (Context & Motivation)

在完成了 `v0.4.10` 的端侧不可变 Checkpointing 与容错断点续跑后，PatchCat 已经具备了状态切片保存与增量子图复用的能力。然而，在深入复盘去中心化 P2P 经典先驱 **Patchwork** 的退役教训并确立 **[ADR-003: Linux 工具哲学与检查点快照抉择](file:///f:/git/ai-prompt-orchestrator/docs/04-dev-notes/adr-003-event-sourcing-vs-checkpointing-and-local-first-lessons.md)** 之后，我们明确了端侧高韧性系统的生命线：**轻量克制、时态隔离、防膨胀治理与物理级数据主权**。

目前系统面临两大必须立即收敛的工程隐患：
1. **时态流与存储混杂隐患**：随着 LLM 吐字速度加快（60+ tokens/s）与思维链（Reasoner）的引入，若将高频瞬态流直接或间接触发持久层写入，将造成严重的写放大，导致浏览器 IndexedDB 锁死；
2. **本地 API Key 明文裸奔与资产分享泄露**：目前前端多将 API Key 存放于 `localStorage`，极易被恶意浏览器插件通过 DOM/Storage 抓取；且用户在导出精调的工作流 JSON 分享时，缺乏一键脱敏机制，极易意外泄露敏感密钥与私有路径。

#### 核心金句先行 (Quotable Snippet)

> **“本地优先不仅是把数据留在本地，更是对本地资产的敬畏。恪守 Linux 小工具的极简组合哲学：瞬态流归内存，快照流归磁盘，敏感密钥归 Web Crypto 暗室，各司其职，坚决杜绝存储膨胀与明文泄露。”**

---

### 2. 架构红线与防偏离规约 (Guardrails & Red Lines)

**任何后续承接此 PRD 的 Agent 必须无条件遵守以下 3 条工程红线（违者直接视为架构违规）：**

* 🚫 **红线 1：严禁自研非标黑盒框架（No Bespoke Frameworks）**
  * 状态流转死守 **Zustand**，画布死守 **React Flow**，持久化死守原生 **IndexedDB**。
  * **严禁引入 WebAssembly SQLite**（存在单写锁与多标签页 Leader 选举死锁陷阱）；
  * **严禁引入重型 Event Sourcing 框架或 Reducer 引擎**（死守方案 C 独立静态 JSON 快照）。
* 🚫 **红线 2：瞬态流（Ephemeral）绝对禁止落盘**
  * LLM 逐字 Streaming Token、DeepSeek 思维链增量推送、节点 Running 高亮脉冲，仅驻留 Zustand 内存与 UI 渲染通道；
  * **严禁在流式吐字期间调用任何 IndexedDB/LocalStorage 写操作**。
* 🚫 **红线 3：存储强契约解耦（`IStorageAdapter`）**
  * 调度器与 UI 严禁直接调用 IndexedDB 底层 API，所有读写必须严格经由 `src/services/storage/indexeddb-adapter.ts` 中的契约接口。

---

### 3. 功能特性与技术规范 (Technical Specifications)

#### 3.1 时态数据物理隔离与 Metadata-First 分层 (`v0.4.11`)

```
                          ┌──────────────────────────────────────┐
                          │         时态数据物理分层模型          │
                          └──────────────────┬───────────────────┘
                                             │
                    ┌────────────────────────┴────────────────────────┐
                    ▼                                                 ▼
        ┌───────────────────────┐                         ┌───────────────────────┐
        │   瞬态通道 (Ephemeral) │                         │  持久快照 (Persistent) │
        │ • Streaming Token 流  │                         │ • 节点完成不可变快照   │
        │ • 思维链推导增量      │                         │ • DAGCheckpoint (FIFO)│
        │ • 节点实时高亮脉冲    │                         │ • 显式保存图拓扑      │
        │ ──► 仅驻留 Zustand 内存│                         │ ──► 异步写入 IndexedDB │
        └───────────────────────┘                         └───────────────────────┘
```

1. **IndexedDB 目录化拆分**：
   * `workflows_meta` 表：存储 `{ id, name, description, tags, nodeCount, updatedAt, version }`。侧边栏与管理抽屉仅读此表，实现冷启动 $< 5\text{ms}$；
   * `workflows_payload` 表：存储 `{ id, nodes, edges, viewport, nodeConfigs }`，仅在用户点击具体工作流时触发懒加载。
2. **快照 FIFO 滚动清理器 (Logrotate)**：
   * 严格锁定单工作流最多保留 **5 条快照**。新增快照时若超过上限，调用底层原子事务剔除最旧快照。

#### 3.2 Web Crypto API (AES-GCM) 本地暗室 (`v0.4.13`)

```typescript
/**
 * 本地主密钥派生与 AES-256-GCM 加密暗室
 */
export interface EncryptedVaultPayload {
  version: 1;
  saltHex: string;       // PBKDF2 盐值 (16 bytes)
  ivHex: string;         // AES-GCM 初始化向量 (12 bytes)
  ciphertextHex: string; // 加密密文
  authTagLength: 128;
}
```

1. **密钥隔离**：
   * 用户首次启动或在设置页面设置「本地安全主口令（Master Passphrase）」；
   * 使用 `crypto.subtle.importKey` + `PBKDF2`（100,000 次哈希迭代）派生 256 位 AES-GCM 主密钥；
   * 所有 Provider 的 API Key 经加密后存入 IndexedDB `secure_vault` 表；
   * **内存策略**：内存中仅在向 Provider 发起实际 HTTPS 请求时短暂解密，关闭页面或锁屏时自动丢弃派生密钥。

#### 3.3 工作流资产一键脱敏导出 (`v0.4.13`)

```typescript
export interface SanitizedExportOptions {
  stripApiKeys: boolean;       // 剥离已绑定的模型 API Key (默认: true)
  maskSensitivePromptVars: boolean; // 脱敏 Prompt 中标记为 [SECRET_*] 的变量 (默认: true)
  stripLocalPaths: boolean;    // 擦除本地知识库绝对物理文件路径 (默认: true)
}
```

1. **导出弹窗（Sanitized Export Modal）**：
   * 用户点击导出工作流时，默认勾选「生产脱敏模式」；
   * 自动扫描并清空 `node.data.config.apiKey`、`localPath`；
   * 生成纯净的 `.patchcat.json` 逻辑拓扑文件，保障跨机器导入零隐私风险。

---

### 4. 实施阶段与版本验收清单 (Definition of Done)

#### Milestone 1: `v0.4.11` (底座防膨胀与时态隔离)
- [ ] 验证流式吐字期间 IndexedDB 写入计数为 0；
- [ ] 连续运行 30 次工作流，单工作流快照数量严格恒定为 5，无旧数据残留；
- [ ] `workflows_meta` 目录表分离完成，抽屉打开延迟 $< 10\text{ms}$。

#### Milestone 2: `v0.4.13` (本地加密暗室与资产脱敏)
- [ ] 在 DevTools 中全文扫描，LocalStorage/IndexedDB 绝无明文 API Key；
- [ ] 验证脱敏导出的工作流文件在未配置环境成功导入且不带入旧密钥；
- [ ] `tests/crypto-vault.node.test.ts` 契约单元测试 100% 覆盖。

---

<a name="english-version"></a>
## English Version

*(Refer to Chinese version for complete technical specifications. Adheres strictly to ADR-003 and Unix small-tools composition philosophy).*
