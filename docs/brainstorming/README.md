# 💡 PatchCat 头脑风暴与创意 Backlog (Brainstorming & Idea Vault)

> 本目录作为 PatchCat 项目的**创新构想池、前沿交互探索与架构演进 Backlog**。所有从日常实战、社区反馈与前沿 AI 原生交互中激发的头脑风暴构想，均沉淀于此，作为后续版本迭代与 PRD 孵化的源泉。

---

## 🧭 创意 Backlog 清单

| 序号 | 创意提案 | 核心分类 | 目标版本 | 评估复杂度 | 状态 | 详细设计与 PRD |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 01 | **智能体驾驶舱与双模运行态 (Studio vs. Cockpit)** | 交互架构 | v2.0 | 中高 | 📋 Backlog (Draft) | [查看 PRD](./PRD-PatchCat-2.0-Cockpit-Architecture.md#3-模块二双模切换架构--studio-编排态-vs-cockpit-驾驶舱-dual-mode-architecture) |
| 02 | **上下文雷达与一键「注入提示词」抽屉 (Context Dock)** | 调试体验 | v2.0 | 中 | 📋 Backlog (Draft) | [查看 PRD](./PRD-PatchCat-2.0-Cockpit-Architecture.md#2-模块一上下文雷达与一键注入提示词抽屉-context-dock) |
| 03 | **Local-First 隐私状态感知胶囊与指标看板** | 信任外显 | v2.0 | 低 | 📋 Backlog (Draft) | [查看 PRD](./PRD-PatchCat-2.0-Cockpit-Architecture.md#4-模块三local-first-隐私状态感知胶囊与内核指标看板-privacy-capsule) |
| 04 | **智能体长期记忆档案与全局画像中心 (Memory Vault)** | 记忆与上下文 | v2.1 | 中 | 📋 Backlog (Draft) | [查看 PRD](./PRD-PatchCat-2.0-Cockpit-Architecture.md#5-模块四智能体长期记忆档案与全局画像中心-global-persona--memory-vault) |
| 05 | **Agent 思考态生命感与动态粒子微交互 (Aliveness Orb)** | 视觉体验 | v2.1 | 中 (需守住内存红线) | 📋 Backlog (Draft) | [查看 PRD](./PRD-PatchCat-2.0-Cockpit-Architecture.md#6-模块五agent-思考态生命感与动态粒子微交互-aliveness-particle--ambient-state) |

---

## 📂 文档与资产索引

* **核心需求规格**：[`PRD-PatchCat-2.0-Cockpit-Architecture.md`](./PRD-PatchCat-2.0-Cockpit-Architecture.md)  
  *涵盖 5 大功能模块痛点剖析、交互线框 Wireframe、TypeScript 接口契约、甘特图演进路线与性能预算控制。*
* **概念原型资产**：[`./assets/`](./assets/)  
  *包含各模块的暗色系高保真 UI 原型设计示意图。*

---

## 🛠️ 创意孵化流转标准 (Lifecycle)

每个进入本目录的头脑风暴提案遵循以下工作流推进：

```mermaid
flowchart LR
    A["💡 灵感与痛点 (Idea)"] --> B["📝 头脑风暴与草案 (Brainstorming PRD)"]
    B --> C["⚖️ 架构评估与性能红线权衡 (RFC Review)"]
    C --> D["🎯 正式纳入开发排期 (Roadmap Phase)"]
    D --> E["🚀 编码实现与交付 (Released)"]
```

1. **Idea 阶段**：记录用户真实痛点与创新交互点，形成概念线框图与原型；
2. **Brainstorming PRD**：细化端到端数据流、状态机以及对纯前端无后端核心特性的兼容度；
3. **RFC Review**：严格对照 PatchCat 的 `<35MB` 内存红线与零后端依赖原则进行技术选型权衡；
4. **Graduation**：评审通过后移入 `docs/01-prd` 正式产品文档库并同步更新 `ROADMAP.md`。
