import React, { useState } from 'react';
import { Terminal, Code2, Wrench, RotateCcw, ChevronUp, Check } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';

interface CodeNodePropertiesProps {
  nodeId: string;
  config: Record<string, unknown>;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
}

interface SnippetDef {
  id: string;
  titleZh: string;
  titleEn: string;
  descZh: string;
  descEn: string;
  code: string;
}

const SNIPPETS: SnippetDef[] = [
  {
    id: 'markdown_json',
    titleZh: '提取 Markdown JSON 块',
    titleEn: 'Extract Markdown JSON',
    descZh: '自动提取 ```json ... ``` 块并转为标准对象，内置异常容错',
    descEn: 'Extract fenced JSON codeblocks and parse into structured objects',
    code: `// 自动提取文本中的 Markdown \`\`\`json ... \`\`\` 块并解析为结构化对象
const text = typeof inputs === 'string' ? inputs : Object.values(inputs)[0] || '';
const match = String(text).match(/\`\`\`json\\s*([\\s\\S]*?)\\s*\`\`\`/) || String(text).match(/\\{[\\s\\S]*\\}/);

if (match) {
  try {
    return JSON.parse(match[1] || match[0]);
  } catch (err) {
    return { raw: text, error: 'JSON parse failed', message: String(err) };
  }
}
return { raw: text, parsed: null };`,
  },
  {
    id: 'line_split',
    titleZh: '文本按换行切分数组',
    titleEn: 'Split Lines to Array',
    descZh: '清洗首尾不可见字符并按换行拆分为非空列表',
    descEn: 'Trim whitespace and split multi-line string into an array',
    code: `// 清洗首尾不可见字符并按换行拆分为非空列表
const text = String(typeof inputs === 'string' ? inputs : Object.values(inputs)[0] || '');
return text
  .split('\\n')
  .map(line => line.trim())
  .filter(line => line.length > 0);`,
  },
  {
    id: 'strip_whitespace',
    titleZh: '文本去空白与标点',
    titleEn: 'Clean Whitespace',
    descZh: '清洗不可见换行与冗余重复空白字符',
    descEn: 'Clean invisible characters and collapse multiple whitespaces',
    code: `// 清洗不可见换行与冗余重复空白字符
const text = String(typeof inputs === 'string' ? inputs : Object.values(inputs)[0] || '');
return text.replace(/[\\r\\n\\t]+/g, ' ').replace(/\\s{2,}/g, ' ').trim();`,
  },
  {
    id: 'merge_dicts',
    titleZh: '多源字典扁平合并',
    titleEn: 'Flat Merge Upstream Dicts',
    descZh: '将上游多分支输出对象合并为一个扁平字典',
    descEn: 'Merge upstream dictionary branches into a single consolidated object',
    code: `// 将上游所有输入对象合并为一个扁平字典
const result = {};
for (const [key, val] of Object.entries(inputs)) {
  if (typeof val === 'object' && val !== null) {
    Object.assign(result, val);
  } else {
    result[key] = val;
  }
}
return result;`,
  },
];

export const CodeNodeProperties: React.FC<CodeNodePropertiesProps> = ({
  nodeId,
  config,
  updateNodeConfig,
}) => {
  const { language } = useTranslation();
  const isZh = language === 'zh';

  const currentCode =
    (config['script'] as string) ||
    (config['code'] as string) ||
    '// Transformation function\nreturn inputs;';

  const activeSnippetId = config['activeSnippet'] as string | undefined;
  const activeSnippet = SNIPPETS.find((s) => s.id === activeSnippetId);

  // If a snippet is active, default to folded view unless user toggles advanced edit
  const [isAdvancedEditing, setIsAdvancedEditing] = useState(!activeSnippet);

  const handleSelectSnippet = (snippet: SnippetDef) => {
    updateNodeConfig(nodeId, {
      script: snippet.code,
      activeSnippet: snippet.id,
    });
    setIsAdvancedEditing(false);
  };

  const handleResetSnippet = () => {
    if (activeSnippet) {
      updateNodeConfig(nodeId, {
        script: activeSnippet.code,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Quick Snippet Capsules */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>{isZh ? '常用代码片段 (开箱即用)' : 'Production Snippets'}</span>
          </span>
          <span className="text-[10px] text-slate-500 font-normal">
            {isZh ? '点击自动载入' : 'Click to load'}
          </span>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {SNIPPETS.map((snippet) => {
            const isSelected = activeSnippetId === snippet.id;
            return (
              <button
                key={snippet.id}
                type="button"
                onClick={() => handleSelectSnippet(snippet)}
                className={`p-2 rounded-xl text-left border text-xs transition flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1 w-full font-semibold">
                  <span className="truncate">{isZh ? snippet.titleZh : snippet.titleEn}</span>
                  {isSelected && <Check className="w-3 h-3 text-amber-400 shrink-0" />}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {isZh ? snippet.descZh : snippet.descEn}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Progressive Disclosure Container */}
      {activeSnippet && !isAdvancedEditing ? (
        // Folded friendly card for non-technical users
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 shadow-lg space-y-3 animate-in fade-in">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400">
                ⚡
              </span>
              <div>
                <div className="text-xs font-bold text-amber-300">
                  {isZh ? '当前已启用标准片段' : 'Active Standard Snippet'}
                </div>
                <div className="text-[11px] font-semibold text-slate-200">
                  {isZh ? activeSnippet.titleZh : activeSnippet.titleEn}
                </div>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
              {isZh ? '内置防呆就绪' : 'Ready'}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            {isZh ? activeSnippet.descZh : activeSnippet.descEn}
          </p>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setIsAdvancedEditing(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-medium rounded-xl border border-amber-500/20 hover:border-amber-500/40 transition flex items-center gap-1.5 shadow-sm"
            >
              <Wrench className="w-3 h-3" />
              <span>{isZh ? '🛠️ 高级编辑 (查看/修改源码)' : '🛠️ Advanced Edit (View Code)'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetSnippet}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition flex items-center gap-1"
              title={isZh ? '重置为初始片段代码' : 'Reset to original snippet code'}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{isZh ? '还原默认' : 'Reset'}</span>
            </button>
          </div>
        </div>
      ) : (
        // Raw Code Editor with unlock status
        <div className="space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>{isZh ? 'JavaScript 运行沙箱源码' : 'JavaScript Sandbox Source'}</span>
            </label>

            {activeSnippet && (
              <button
                type="button"
                onClick={() => setIsAdvancedEditing(false)}
                className="text-[11px] text-slate-400 hover:text-amber-300 transition flex items-center gap-1"
              >
                <ChevronUp className="w-3 h-3" />
                <span>{isZh ? '收起为卡片' : 'Fold Card'}</span>
              </button>
            )}
          </div>

          <textarea
            rows={10}
            value={currentCode}
            onChange={(e) =>
              updateNodeConfig(nodeId, {
                script: e.target.value,
              })
            }
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 text-amber-300 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-y border border-slate-800 shadow-inner"
            placeholder="return inputs;"
            spellCheck={false}
          />

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
            <span>
              {isZh
                ? '提示：支持 ES6 语法，入参通过 inputs 访问，最后通过 return 输出'
                : 'Supports ES6. Access variables via inputs, output using return.'}
            </span>
            {activeSnippet && (
              <button
                type="button"
                onClick={handleResetSnippet}
                className="text-amber-400/80 hover:text-amber-300 transition flex items-center gap-1"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>{isZh ? '还原片段' : 'Restore'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
