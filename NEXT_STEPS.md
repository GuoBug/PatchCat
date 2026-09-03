# 🎯 下次开发接续清单 (Next Steps)

> **当前版本**: `v0.1.0` (准备跃升至 `v0.2.0`)  
> **更新时间**: 2026-09-03  
> **前序完成**: Phase 2（知识库 RAG 向量引擎与画布检索节点 100% 完工，前后端 76 项测试全绿）  
> **当前状态**: 准备进行 `v0.2.0` 正式发版的“临门一脚”闭环  

---

## ⚡ 下次开工即刻行动清单 (Immediate Action Plan)

### 1. 内置【RAG 知识库增强问答】开箱即用预设模板
- [ ] 在 `src/presets/index.ts` 中新增 `rag-qa` 预设拓扑结构：
  - 节点链路：`Input (用户提问)` ➔ `Knowledge (知识库召回)` ➔ `Prompt (引文组装)` ➔ `LLM (模型解答)` ➔ `Output (答案渲染)`；
  - 配备规范的变量插值（`{{input_1.user_question}}`、`{{knowledge_1.result}}`、`{{llm_1.response}}`）；
- [ ] 在 `src/components/panels/ControlHeader.tsx` 的预设下拉菜单中注册 `rag-qa`，提供中英双语标签与使用场景说明；
- [ ] 验证点击预设后，画布能瞬间一键生成完整清晰的 RAG 链路。

### 2. 正式跃升版本号至 `v0.2.0` (Version Bump)
- [ ] 修改 `package.json` 中的 `"version"`：由 `0.1.0` 跃升至 **`0.2.0`**；
- [ ] 修改 `src/components/panels/ControlHeader.tsx` 顶栏的 Version Badge：由 `v0.1` 切换为 **`v0.2`**；
- [ ] 更新 `README.md` 与 `README_CN.md` 中的版本展示徽标。

### 3. 补齐两个正式发版开源规范文档
- [ ] 根目录新建 **`CHANGELOG.md`**：
  - 遵循 *Keep a Changelog* 与 *SemVer* 规范；
  - 完整记录 `v0.1.0`（初始调度原型）到 `v0.2.0`（后端架构、双模存储、多流程管理、RAG 向量体系）的全部 `Added`、`Changed` 与 `Fixed`。
- [ ] 根目录新建 **`CONTRIBUTING.md`**：
  - 贡献者指南：本地环境搭建（Node 22 / Python 3.10）、代码规范、分支与 Commit Message 规则、测试准入要求。

### 4. 终测验收与 Git Tag 打标
- [ ] 运行全量测试验证：
  - 前端测试：`npm test`（确保 64+ 项测试全绿）
  - 后端测试：`python -m pytest tests/`（确保 12 项测试全绿）
  - 类型检查：`npm run typecheck`（零 TS 报错）
  - 生产打包：`npm run build`（打包成功）
- [ ] Git 提交发版记录并打标：
  - `git commit -m "chore(release): bump version to v0.2.0 and add release notes"`
  - `git tag -a v0.2.0 -m "Release v0.2.0: Backend Architecture, Multi-Workflow Drawer & Complete RAG Pipeline"`

---

## 🛠️ 常用验证命令备忘

```bash
# 1. 运行前端全量单元测试
npm test

# 2. 运行后端全量自动化测试
cd server; python -m pytest -v tests/; cd ..

# 3. 严格类型检查
npm run typecheck

# 4. 生产环境打包构建
npm run build
```
