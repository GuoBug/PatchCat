import React, { useState } from 'react';
import {
  X,
  BookOpen,
  HelpCircle,
  ExternalLink,
  Sparkles,
  Workflow,
  Keyboard,
  CheckCircle2,
  FileText,
  Github,
  User,
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'quickstart' | 'nodes' | 'shortcuts' | 'docs'>('quickstart');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-800 dark:text-slate-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-sky-400 border border-blue-200 dark:border-blue-800/50">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>PatchCat 帮助与使用文档</span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-sky-300">
                  v0.1.0
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                可视化 AI Prompt 编排引擎与多智能体工作流快速上手指南
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="关闭 (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/80 dark:bg-slate-950/20 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab('quickstart')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'quickstart'
                ? 'border-blue-600 text-blue-600 dark:text-sky-400 dark:border-sky-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>🚀 快速上手</span>
          </button>
          <button
            onClick={() => setActiveTab('nodes')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'nodes'
                ? 'border-blue-600 text-blue-600 dark:text-sky-400 dark:border-sky-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Workflow className="w-4 h-4" />
            <span>🧩 节点指南</span>
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'shortcuts'
                ? 'border-blue-600 text-blue-600 dark:text-sky-400 dark:border-sky-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>⌨️ 快捷操作</span>
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'docs'
                ? 'border-blue-600 text-blue-600 dark:text-sky-400 dark:border-sky-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>📚 完整文档与外链</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {/* TAB 1: 快速上手 */}
          {activeTab === 'quickstart' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 space-y-1.5">
                <div className="font-semibold text-blue-900 dark:text-sky-300 flex items-center gap-1.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                  <span>30秒开启您的第一个 AI 流水线</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  PatchCat 支持纯浏览器本地运行与客户端直连（BYOK 自带 Key 模式），您的 API Key 和 Prompt 数据全部存储在浏览器本地，不会上传至任何第三方中转服务器。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-mono">1</span>
                    <span>配置 API Key</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    点击右上角 <span className="font-mono text-slate-700 dark:text-slate-200 font-semibold">API Key</span> 按钮，填入 Google Gemini、DeepSeek、OpenAI 或 SiliconFlow 的 Key，亦可直连本地 Ollama。
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-mono">2</span>
                    <span>选择预置模板</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    在顶部下拉菜单选择预置场景（如 “Customer Support Routing” 或 “Report Generator with Critic”），一键载入工业级工作流。
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-mono">3</span>
                    <span>点击 Run 运行</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    点击右上角 <span className="font-semibold text-blue-600 dark:text-sky-400">▶ Run Workflow</span>，观察 DAG 拓扑分层调度、实时流式吐字与思考链呈现。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 节点指南 */}
          {activeTab === 'nodes' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white font-mono">Input Node (输入节点)</div>
                  <p className="text-slate-500 dark:text-slate-400">
                    定义工作流的全局输入参数（如用户提问、工单内容、上下文数据）。下游节点可通过变量占位符引用。
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white font-mono">Prompt Node (提示词模板节点)</div>
                  <p className="text-slate-500 dark:text-slate-400">
                    编写精准的 Prompt 模版，支持 Mustache 变量插槽（如 <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono text-[10px]">{`{{inputs.ticket}}`}</code> 或 <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono text-[10px]">{`{{node_id.output}}`}</code>）。
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white font-mono">LLM Node (大语言模型推理节点)</div>
                  <p className="text-slate-500 dark:text-slate-400">
                    调用已配置的大模型进行推理，支持流式输出、DeepSeek R1 深度思考链可视化、Temperature 与 Max Tokens 参数微调。
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white font-mono">Code Node (JavaScript 代码转换节点)</div>
                  <p className="text-slate-500 dark:text-slate-400">
                    轻量沙箱环境，用于解析 JSON、字段提取、路由判断或数据格式清洗变换。
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white font-mono">Output Node (输出分发节点)</div>
                  <p className="text-slate-500 dark:text-slate-400">
                    聚合最终结果，提供可视化格式化展示或导出供下游业务消费。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 快捷操作 */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">缩放画布</span>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                    鼠标滚轮 / 触控板双指
                  </kbd>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">平移画布</span>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                    按住鼠标左键/中键拖拽
                  </kbd>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">删除节点 / 连线</span>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                    Backspace / Delete / 连线右侧 ×
                  </kbd>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">打开属性检查抽屉</span>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                    单击任意节点
                  </kbd>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">打开/收起日志控制台</span>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                    右上角 “日志” 按钮
                  </kbd>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">切换深色 / 浅色模式</span>
                  <kbd className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                    右上角 ☀️ / 🌙 按钮
                  </kbd>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 完整文档与外链 */}
          {activeTab === 'docs' && (
            <div className="space-y-3">
              <a
                href="https://github.com/gu0bug/PatchCat"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Github className="w-5 h-5 text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>GitHub 代码仓库 (Open Source Repository)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      查看源代码、Star 项目、提交 Pull Request 或报告 Bug
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors" />
              </a>

              <a
                href="https://github.com/gu0bug/PatchCat/blob/main/docs/quick-start-zh.md"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-500 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>中文快速入门指南 (Quick Start Manual)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      详细的 5 分钟上手教程、模型对接指南与高级调试技巧
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors" />
              </a>

              <a
                href="https://github.com/gu0bug/PatchCat/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-5 h-5 text-amber-500 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>问题反馈与交流 (Issues & Discussions)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      提出新功能需求、报告运行异常或与开发者交流
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors" />
              </a>

              <a
                href="https://github.com/gu0bug"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-purple-500 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>作者主页 (Author: Gu0Qiang)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      GitHub @gu0bug (Gu0Qiang)
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors" />
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span>Author:</span>
            <a
              href="https://github.com/gu0bug"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-sky-400 underline underline-offset-2 transition-colors"
            >
              Gu0Qiang
            </a>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/gu0bug/PatchCat"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors"
            >
              知道了 (Close)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
