# 🎯 下次开发接续清单 (Next Steps)

> **当前版本**: `v0.2.0` (已正式发布 🎉)  
> **更新时间**: 2026-09-03  
> **前序完成**: `v0.2.0` 全面发布（内置 RAG 预设、版本跃升、CHANGELOG 与 CONTRIBUTING 规范文档齐备，全量 77 项测试 100% 绿灯通过，已打 Git Tag `v0.2.0`）  
> **当前状态**: 准备开启 **Phase 2.5: 知识库可视化管理与本地文件解析**  

---

## ⚡ 下次开工即刻行动清单 (Immediate Action Plan)

### 1. 前端知识库可视化管理抽屉 (Knowledge Management Drawer)
- [ ] 在左侧抽屉或顶栏增加【知识库管理】专属入口与面板；
- [ ] 支持可视化查看知识库列表、每个库下的文档列表与切片（Chunks）明细；
- [ ] 支持单条切片的“启用 / 停用”状态切换与检索命中计数（`hit_count`）热度展示。

### 2. 本地富文本文件解析器接入 (Document Parsers)
- [ ] 支持本地拖拽上传 `.markdown`、`.txt`、`.pdf` 文件；
- [ ] 接入轻量 PDF 文本抽取库，与后端的文本清洗器（`cleaner.py`）无缝对接；
- [ ] 验证从本地上传 PDF 到切片生成、向量嵌入的全流程测试。

### 3. 混合检索与重排序预研 (Hybrid Search & Reranker)
- [ ] 调研并在轻量模式下实现 BM25 稀疏检索算法；
- [ ] 实现稠密向量余弦距离与 BM25 关键词分数的加权融合（RRF 算法）。

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
