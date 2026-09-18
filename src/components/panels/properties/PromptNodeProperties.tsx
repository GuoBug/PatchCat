import React, { useState, useRef, useMemo } from 'react';
import { Sparkles, AtSign, Plus } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';
import { useWorkflowStore } from '../../../stores/workflow-store.ts';
import type { VariableReference } from '../../../engine/variable-resolver.ts';

interface PromptNodePropertiesProps {
  nodeId: string;
  template: string;
  extractedSlots: VariableReference[];
  onTemplateChange: (newTemplate: string) => void;
}

interface UpstreamField {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  field: string;
  token: string;
  desc: string;
}

export const PromptNodeProperties: React.FC<PromptNodePropertiesProps> = ({
  nodeId,
  template,
  extractedSlots,
  onTemplateChange,
}) => {
  const { language } = useTranslation();
  const isZh = language === 'zh';

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  // ── Design-Time Static Output Contract Extractor ─────────────────────────
  const upstreamFields: UpstreamField[] = useMemo(() => {
    // 1. Find all edges pointing into this node
    const incomingEdges = edges.filter((e) => e.target === nodeId);
    const sourceNodeIds = Array.from(new Set(incomingEdges.map((e) => e.source)));

    const fields: UpstreamField[] = [];

    for (const sId of sourceNodeIds) {
      const src = nodes.find((n) => n.id === sId);
      if (!src) continue;

      const sType = src.type;
      const sLabel = src.data.label || sId;
      const config = (src.data.config || {}) as Record<string, unknown>;

      switch (sType) {
        case 'input': {
          const params = (config['parameters'] || []) as Array<{ key: string; description?: string }>;
          if (params.length > 0) {
            params.forEach((p) => {
              fields.push({
                nodeId: sId,
                nodeLabel: sLabel,
                nodeType: 'input',
                field: p.key,
                token: `{{${sId}.${p.key}}}`,
                desc: p.description || (isZh ? '入参字段' : 'Input parameter'),
              });
            });
          } else {
            fields.push({
              nodeId: sId,
              nodeLabel: sLabel,
              nodeType: 'input',
              field: 'query',
              token: `{{${sId}.query}}`,
              desc: isZh ? '默认输入内容' : 'Default input query',
            });
          }
          break;
        }
        case 'knowledge':
          fields.push(
            {
              nodeId: sId,
              nodeLabel: sLabel,
              nodeType: 'knowledge',
              field: 'result',
              token: `{{${sId}.result}}`,
              desc: isZh ? '知识库匹配切片汇总文本' : 'Knowledge retrieval context text',
            },
            {
              nodeId: sId,
              nodeLabel: sLabel,
              nodeType: 'knowledge',
              field: 'records',
              token: `{{${sId}.records}}`,
              desc: isZh ? '检索召回命中文档列表对象' : 'List of matched source chunks',
            },
          );
          break;
        case 'llm':
          fields.push(
            {
              nodeId: sId,
              nodeLabel: sLabel,
              nodeType: 'llm',
              field: 'response',
              token: `{{${sId}.response}}`,
              desc: isZh ? '大模型生成回答内容' : 'LLM generated response text',
            },
            {
              nodeId: sId,
              nodeLabel: sLabel,
              nodeType: 'llm',
              field: 'reasoning',
              token: `{{${sId}.reasoning}}`,
              desc: isZh ? '思维链推理过程 (CoT)' : 'Chain-of-Thought reasoning trace',
            },
          );
          break;
        case 'code':
          fields.push({
            nodeId: sId,
            nodeLabel: sLabel,
            nodeType: 'code',
            field: 'result',
            token: `{{${sId}.result}}`,
            desc: isZh ? '代码沙箱执行输出对象' : 'Sandbox return value',
          });
          break;
        case 'http':
          fields.push(
            {
              nodeId: sId,
              nodeLabel: sLabel,
              nodeType: 'http',
              field: 'response',
              token: `{{${sId}.response}}`,
              desc: isZh ? 'HTTP 响应报文内容' : 'API response body',
            },
            {
              nodeId: sId,
              nodeLabel: sLabel,
              nodeType: 'http',
              field: 'status',
              token: `{{${sId}.status}}`,
              desc: isZh ? 'HTTP 状态码 (200, 404 等)' : 'HTTP status code',
            },
          );
          break;
        case 'aggregator': {
          const outKey = (config['outputKey'] as string) || 'aggregated';
          fields.push({
            nodeId: sId,
            nodeLabel: sLabel,
            nodeType: 'aggregator',
            field: outKey,
            token: `{{${sId}.${outKey}}}`,
            desc: isZh ? '多路合并聚合数据' : 'Aggregated payload array/dict',
          });
          break;
        }
        case 'agent':
          fields.push(
            {
              nodeId: sId,
              nodeLabel: sLabel,
              nodeType: 'agent',
              field: 'response',
              token: `{{${sId}.response}}`,
              desc: isZh ? '智能体最终决策结论' : 'Agent final conclusion',
            },
            {
              nodeId: sId,
              nodeLabel: sLabel,
              nodeType: 'agent',
              field: 'thoughts',
              token: `{{${sId}.thoughts}}`,
              desc: isZh ? '智能体 ReAct 推理步骤日志' : 'Agent reasoning trajectory',
            },
          );
          break;
        default:
          fields.push({
            nodeId: sId,
            nodeLabel: sLabel,
            nodeType: sType,
            field: 'output',
            token: `{{${sId}.output}}`,
            desc: isZh ? '节点输出内容' : 'Node output payload',
          });
          break;
      }
    }

    return fields;
  }, [nodes, edges, nodeId, isZh]);

  // Insert token directly at current cursor position
  const insertToken = (token: string, replaceAt = false) => {
    if (!textareaRef.current) {
      onTemplateChange(template + ' ' + token);
      return;
    }

    const input = textareaRef.current;
    const start = input.selectionStart;
    const end = input.selectionEnd;

    let newText = '';
    let newCursorPos = 0;

    if (replaceAt && start > 0 && template[start - 1] === '@') {
      newText = template.substring(0, start - 1) + token + template.substring(end);
      newCursorPos = start - 1 + token.length;
    } else {
      newText = template.substring(0, start) + token + template.substring(end);
      newCursorPos = start + token.length;
    }

    onTemplateChange(newText);
    setShowMentionMenu(false);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  // Handle textarea typing for @ mention detection
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    onTemplateChange(val);

    // Check if character before cursor is @
    if (pos > 0 && val[pos - 1] === '@') {
      setShowMentionMenu(true);
      setMentionQuery('');
    } else if (showMentionMenu) {
      // If typing after @, treat as query
      const lastAtIndex = val.lastIndexOf('@', pos - 1);
      if (lastAtIndex !== -1 && pos - lastAtIndex < 20) {
        setMentionQuery(val.substring(lastAtIndex + 1, pos));
      } else {
        setShowMentionMenu(false);
      }
    }
  };

  const filteredFields = useMemo(() => {
    if (!mentionQuery.trim()) return upstreamFields;
    const q = mentionQuery.toLowerCase();
    return upstreamFields.filter(
      (f) =>
        f.nodeLabel.toLowerCase().includes(q) ||
        f.field.toLowerCase().includes(q) ||
        f.desc.toLowerCase().includes(q),
    );
  }, [upstreamFields, mentionQuery]);

  return (
    <div className="space-y-4 relative">
      {/* 1. Design-Time Static Output Contracts Pills */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <AtSign className="w-3.5 h-3.5 text-violet-500 dark:text-purple-400" />
            <span>{isZh ? '上游契约变量 (设计期静态推导)' : 'Upstream Schema Contracts'}</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {upstreamFields.length} {isZh ? '个可用插槽' : 'fields'}
          </span>
        </label>

        {upstreamFields.length === 0 ? (
          <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] text-slate-500 text-center">
            {isZh
              ? '暂无上游连线。从其他节点输出端点拉线至本节点即可静态识别变量。'
              : 'No upstream nodes connected yet. Connect nodes to enable static auto-complete.'}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {upstreamFields.map((f, i) => (
              <button
                key={i}
                type="button"
                onClick={() => insertToken(f.token)}
                className="group px-2 py-1 bg-violet-950/40 hover:bg-violet-900/60 border border-violet-800/40 hover:border-violet-600 rounded-lg text-xs font-mono text-purple-300 transition flex items-center gap-1"
                title={`${f.nodeLabel} ➔ ${f.desc}`}
              >
                <Plus className="w-2.5 h-2.5 text-purple-400 group-hover:scale-125 transition-transform" />
                <span>{f.nodeLabel}.{f.field}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Textarea with in-place @ Autocomplete Popover */}
      <div className="space-y-2 relative">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-500 dark:text-purple-400" />
            <span>{isZh ? '提示词模板与动态插槽' : 'Prompt Template & Slots'}</span>
          </label>
          <span className="text-[10px] text-slate-500">
            {isZh ? '输入 @ 快速补全' : 'Type @ to complete'}
          </span>
        </div>

        <textarea
          ref={textareaRef}
          rows={9}
          value={template}
          onChange={handleTextareaChange}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && showMentionMenu) {
              setShowMentionMenu(false);
            }
          }}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-y transition-all shadow-inner"
          placeholder={
            isZh
              ? '请作为资深助手，基于 @ 或 {{input.query}} 输出结构化报告...'
              : 'Write instructions and insert variables like @ or {{input.query}}...'
          }
          spellCheck={false}
        />

        {/* Floating @ Mention Popover */}
        {showMentionMenu && (
          <div className="absolute left-3 right-3 top-20 z-50 bg-slate-900 border border-violet-500/50 rounded-xl shadow-2xl p-2 max-h-52 overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-purple-300 border-b border-slate-800 mb-1">
              <span>{isZh ? '选择要插入的上游变量' : 'Select Upstream Variable'}</span>
              <span className="text-[10px] text-slate-500">{isZh ? 'ESC 关闭' : 'ESC to close'}</span>
            </div>
            {filteredFields.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                {isZh ? '没有匹配的上游变量' : 'No matching upstream variable'}
              </div>
            ) : (
              filteredFields.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => insertToken(f.token, true)}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-violet-950/60 hover:border-violet-600/40 border border-transparent transition flex items-center justify-between group text-xs font-mono text-slate-200"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] bg-slate-800 text-purple-300 px-1.5 py-0.5 rounded border border-slate-700 uppercase">
                      {f.nodeType}
                    </span>
                    <span className="font-semibold text-white group-hover:text-purple-300 truncate">
                      {f.nodeLabel}.{f.field}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                    {f.desc}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Fallback Syntax Guideline */}
        <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 flex items-center justify-between">
          <span>
            {isZh ? '优雅降级语法：' : 'Graceful Fallback: '}
            <code className="text-purple-300 font-mono">
              {"{{node.field | '默认回退值'}}"}
            </code>
          </span>
          <span className="text-[10px] text-emerald-400">
            {isZh ? '上游未连线亦可独立运行' : 'Self-run ready'}
          </span>
        </div>
      </div>

      {/* 3. Extracted Slots Badges */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
          {isZh ? '已识别插槽' : 'Identified Slots'} ({extractedSlots.length})
        </label>
        {extractedSlots.length === 0 ? (
          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-slate-500 text-xs italic text-center">
            {isZh ? '尚未解析到变量插槽，使用 @ 或 {{node.field}} 添加' : 'No slots detected'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {extractedSlots.map((slot, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-purple-500/20 text-xs font-mono"
              >
                <span className="text-purple-300 font-medium truncate">
                  {slot.raw}
                </span>
                {slot.defaultValue ? (
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                    {isZh ? '降级值: ' : 'Fallback: '}
                    {slot.defaultValue}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const withFallback = slot.raw.replace(
                        /\}\}$/,
                        isZh ? " | '暂无数据'}}" : " | 'default'}}",
                      );
                      onTemplateChange(template.replace(slot.raw, withFallback));
                    }}
                    className="text-[10px] text-slate-400 hover:text-purple-300 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-700 transition"
                  >
                    {isZh ? '+ 加默认降级' : '+ Add fallback'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
