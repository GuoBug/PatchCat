import React, { useState } from 'react';
import {
  Share2,
  X,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useProjectStore } from '../../stores/project-store.ts';
import { useSettingsStore } from '../../stores/settings-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { nanoid } from 'nanoid';

interface PublishApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PublishApiModal: React.FC<PublishApiModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const activeWorkflowId = useProjectStore((s) => s.activeWorkflowId);
  const workflows = useProjectStore((s) => s.workflows);
  const updateWorkflow = useProjectStore((s) => s.updateWorkflow);
  const serverBaseUrl = useSettingsStore((s) => s.serverBaseUrl) || 'http://localhost:8000';

  const activeWf = workflows.find((w) => w.id === activeWorkflowId) || workflows[0];
  const [activeSnippetTab, setActiveSnippetTab] = useState<'curl' | 'python' | 'js'>('curl');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  if (!isOpen || !activeWf) return null;

  const isEnabled = Boolean((activeWf as any).api_enabled);
  const currentKey = ((activeWf as any).api_key as string) || '';
  const endpointUrl = `${serverBaseUrl}/api/v1/workflows/${activeWf.id}/run`;

  const handleToggleEnable = () => {
    const nextEnabled = !isEnabled;
    const patch: any = { api_enabled: nextEnabled };
    if (nextEnabled && !currentKey) {
      patch.api_key = `pk_live_${nanoid(24)}`;
    }
    updateWorkflow(activeWf.id, patch);
  };

  const handleRegenerateKey = () => {
    const newKey = `pk_live_${nanoid(24)}`;
    updateWorkflow(activeWf.id, { api_key: newKey } as any);
  };

  const handleCopy = (text: string, type: 'snippet' | 'key') => {
    navigator.clipboard.writeText(text);
    if (type === 'snippet') {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const curlSnippet = `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  ${currentKey ? `-H "X-API-Key: ${currentKey}" \\` : ''}
  -d '{
    "inputs": {
      "query": "Hello from external API"
    },
    "stream": false
  }'`;

  const pythonSnippet = `import requests

url = "${endpointUrl}"
headers = {
    "Content-Type": "application/json",
    ${currentKey ? `"X-API-Key": "${currentKey}",` : ''}
}
payload = {
    "inputs": {
        "query": "Hello from external API"
    },
    "stream": False
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;

  const jsSnippet = `const response = await fetch("${endpointUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ${currentKey ? `"X-API-Key": "${currentKey}",` : ''}
  },
  body: JSON.stringify({
    inputs: {
      query: "Hello from external API"
    },
    stream: false
  })
});

const data = await response.json();
console.log(data);`;

  const snippetMap = {
    curl: curlSnippet,
    python: pythonSnippet,
    js: jsSnippet,
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-sky-500/10 dark:text-sky-400 border border-blue-200 dark:border-sky-500/30">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {t.publishApi.title}
              </h3>
              <p className="text-xs text-slate-400">
                {t.publishApi.subtitle} ({activeWf.name})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Status & Toggle */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                <span>{isEnabled ? t.publishApi.statusActive : t.publishApi.statusDisabled}</span>
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t.publishApi.statusHint}
              </p>
            </div>

            <button
              onClick={handleToggleEnable}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all shadow-xs cursor-pointer ${
                isEnabled
                  ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400 hover:bg-rose-100'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isEnabled ? t.publishApi.disableBtn : t.publishApi.enableBtn}
            </button>
          </div>

          {/* Endpoint URL Display */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              {t.publishApi.endpointUrl}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-800 dark:text-slate-200 select-all truncate">
                {endpointUrl}
              </div>
              <button
                onClick={() => handleCopy(endpointUrl, 'snippet')}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 font-medium transition-colors"
              >
                {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{t.publishApi.copyUrl}</span>
              </button>
            </div>
          </div>

          {/* API Key Management */}
          {isEnabled && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {t.publishApi.apiKey}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-800 dark:text-slate-200 select-all truncate">
                  {currentKey || t.publishApi.noKey}
                </div>
                <button
                  onClick={() => handleCopy(currentKey, 'key')}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 font-medium transition-colors"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{t.publishApi.copyKey}</span>
                </button>
                <button
                  onClick={handleRegenerateKey}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                  title={t.publishApi.regenerateKey}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Code Snippets */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {(['curl', 'python', 'js'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveSnippetTab(tab)}
                    className={`px-2.5 py-1 rounded-md uppercase font-mono text-[11px] font-semibold transition-colors ${
                      activeSnippetTab === tab
                        ? 'bg-blue-50 text-blue-600 dark:bg-sky-500/20 dark:text-sky-300'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    {tab === 'js' ? 'JavaScript' : tab}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleCopy(snippetMap[activeSnippetTab], 'snippet')}
                className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                {copiedSnippet ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{t.publishApi.copyCode}</span>
              </button>
            </div>

            <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 shadow-inner">
              <code>{snippetMap[activeSnippetTab]}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
