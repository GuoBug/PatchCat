import React, { useState } from 'react';
import { Globe, Plus, Trash } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';

interface HttpNodePropertiesProps {
  nodeId: string;
  config: Record<string, unknown>;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
}

type HttpTab = 'params' | 'headers' | 'body' | 'auth' | 'settings';

export const HttpNodeProperties: React.FC<HttpNodePropertiesProps> = ({
  nodeId,
  config,
  updateNodeConfig,
}) => {
  const { t } = useTranslation();
  const [httpTab, setHttpTab] = useState<HttpTab>('params');

  const httpConfig = (config || {}) as {
    method?: string;
    url?: string;
    queryParams?: Record<string, string>;
    headers?: Record<string, string>;
    bodyType?: string;
    bodyContent?: string;
    timeout?: number;
    retryConfig?: { maxRetries: number; retryDelayMs: number };
    authType?: string;
    authConfig?: {
      token?: string;
      username?: string;
      password?: string;
      keyName?: string;
      keyValue?: string;
      addTo?: string;
    };
  };

  function normalizeKeyValRecord(raw: unknown): Record<string, string> {
    if (!raw) return {};
    if (Array.isArray(raw)) {
      const result: Record<string, string> = {};
      for (const item of raw) {
        if (item && typeof item === 'object' && 'key' in item) {
          result[String((item as any).key || '')] = String((item as any).value ?? '');
        }
      }
      return result;
    }
    if (typeof raw === 'object') {
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (v && typeof v === 'object' && 'key' in v) {
          result[String((v as any).key || k)] = String((v as any).value ?? '');
        } else {
          result[k] = typeof v === 'string' ? v : String(v ?? '');
        }
      }
      return result;
    }
    return {};
  }

  const method = (httpConfig.method || 'GET').toUpperCase();
  const url = httpConfig.url || '';
  const queryParams = normalizeKeyValRecord(httpConfig.queryParams);
  const headers = normalizeKeyValRecord(httpConfig.headers);
  const bodyType = httpConfig.bodyType || 'none';
  const bodyContent = httpConfig.bodyContent || '';
  const timeout = httpConfig.timeout || 30000;
  const maxRetries = httpConfig.retryConfig?.maxRetries ?? 1;
  const retryDelayMs = httpConfig.retryConfig?.retryDelayMs ?? 1000;
  const authType = httpConfig.authType || 'none';
  const authConfig = httpConfig.authConfig || {};

  return (
    <div className="space-y-4">
      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
        <span>{t.propertyPanel.httpConfigTitle}</span>
      </label>

      {/* Method & URL Row */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <select
            value={method}
            onChange={(e) => updateNodeConfig(nodeId, { method: e.target.value })}
            className="px-2.5 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold font-mono focus:outline-none focus:border-teal-500 cursor-pointer shrink-0"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>

          <input
            type="text"
            value={url}
            onChange={(e) => updateNodeConfig(nodeId, { url: e.target.value })}
            placeholder={t.propertyPanel.httpUrlPlaceholder}
            className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500"
          />
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
          {t.propertyPanel.httpUrlHint}
        </span>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 text-xs font-medium">
        {[
          { id: 'params' as HttpTab, label: t.propertyPanel.httpTabParams },
          { id: 'headers' as HttpTab, label: t.propertyPanel.httpTabHeaders },
          { id: 'body' as HttpTab, label: t.propertyPanel.httpTabBody },
          { id: 'auth' as HttpTab, label: t.propertyPanel.httpTabAuth },
          { id: 'settings' as HttpTab, label: t.propertyPanel.httpTabSettings },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setHttpTab(tab.id)}
            className={`px-3 py-1.5 border-b-2 capitalize transition-colors cursor-pointer ${
              httpTab === tab.id
                ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      {httpTab === 'params' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 uppercase">
              {t.propertyPanel.httpQueryParamsTitle}
            </span>
            <button
              type="button"
              onClick={() => {
                const next = {
                  ...queryParams,
                  [`param_${Object.keys(queryParams).length + 1}`]: '',
                };
                updateNodeConfig(nodeId, { queryParams: next });
              }}
              className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> {t.propertyPanel.httpAddParam}
            </button>
          </div>
          {Object.entries(queryParams).map(([k, v], idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                value={k}
                onChange={(e) => {
                  const next = { ...queryParams };
                  delete next[k];
                  next[e.target.value] = v;
                  updateNodeConfig(nodeId, { queryParams: next });
                }}
                placeholder="key"
                className="w-1/3 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
              />
              <input
                type="text"
                value={v}
                onChange={(e) => {
                  updateNodeConfig(nodeId, {
                    queryParams: { ...queryParams, [k]: e.target.value },
                  });
                }}
                placeholder="value or {{var}}"
                className="flex-1 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  const next = { ...queryParams };
                  delete next[k];
                  updateNodeConfig(nodeId, { queryParams: next });
                }}
                className="text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <Trash className="w-3 h-3" />
              </button>
            </div>
          ))}
          {Object.keys(queryParams).length === 0 && (
            <p className="text-[11px] text-slate-400 italic py-1">
              {t.propertyPanel.httpNoQueryParams}
            </p>
          )}
        </div>
      )}

      {httpTab === 'headers' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 uppercase">
              {t.propertyPanel.httpHeadersTitle}
            </span>
            <button
              type="button"
              onClick={() => {
                const next = {
                  ...headers,
                  [`Header-${Object.keys(headers).length + 1}`]: '',
                };
                updateNodeConfig(nodeId, { headers: next });
              }}
              className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> {t.propertyPanel.httpAddHeader}
            </button>
          </div>
          {Object.entries(headers).map(([k, v], idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                value={k}
                onChange={(e) => {
                  const next = { ...headers };
                  delete next[k];
                  next[e.target.value] = v;
                  updateNodeConfig(nodeId, { headers: next });
                }}
                placeholder="Header-Name"
                className="w-1/3 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
              />
              <input
                type="text"
                value={v}
                onChange={(e) => {
                  updateNodeConfig(nodeId, { headers: { ...headers, [k]: e.target.value } });
                }}
                placeholder="value"
                className="flex-1 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  const next = { ...headers };
                  delete next[k];
                  updateNodeConfig(nodeId, { headers: next });
                }}
                className="text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <Trash className="w-3 h-3" />
              </button>
            </div>
          ))}
          {Object.keys(headers).length === 0 && (
            <p className="text-[11px] text-slate-400 italic py-1">
              {t.propertyPanel.httpDefaultHeadersHint}
            </p>
          )}
        </div>
      )}

      {httpTab === 'body' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono text-slate-400 uppercase">
              {t.propertyPanel.httpBodyFormat}
            </label>
            <select
              value={bodyType}
              onChange={(e) => updateNodeConfig(nodeId, { bodyType: e.target.value })}
              className="px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono cursor-pointer"
            >
              <option value="none">None</option>
              <option value="json">JSON</option>
              <option value="raw">Raw Text</option>
            </select>
          </div>
          {bodyType !== 'none' && (
            <textarea
              rows={5}
              value={bodyContent}
              onChange={(e) => updateNodeConfig(nodeId, { bodyContent: e.target.value })}
              placeholder={'{\n  "query": "{{input_1.query}}"\n}'}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 resize-y"
            />
          )}
        </div>
      )}

      {httpTab === 'auth' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase block">
              {t.propertyPanel.httpAuthType}
            </label>
            <select
              value={authType}
              onChange={(e) => updateNodeConfig(nodeId, { authType: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono cursor-pointer"
            >
              <option value="none">{t.propertyPanel.httpAuthNone}</option>
              <option value="bearer">{t.propertyPanel.httpAuthBearer}</option>
              <option value="basic">{t.propertyPanel.httpAuthBasic}</option>
              <option value="api-key">{t.propertyPanel.httpAuthApiKey}</option>
            </select>
          </div>

          {authType === 'bearer' && (
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase block">
                {t.propertyPanel.httpBearerTokenLabel}
              </label>
              <input
                type="password"
                value={authConfig.token || ''}
                onChange={(e) =>
                  updateNodeConfig(nodeId, {
                    authConfig: { ...authConfig, token: e.target.value },
                  })
                }
                placeholder="ey..."
                className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
              />
            </div>
          )}

          {authType === 'basic' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block">
                  {t.propertyPanel.httpUsernameLabel}
                </label>
                <input
                  type="text"
                  value={authConfig.username || ''}
                  onChange={(e) =>
                    updateNodeConfig(nodeId, {
                      authConfig: { ...authConfig, username: e.target.value },
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block">
                  {t.propertyPanel.httpPasswordLabel}
                </label>
                <input
                  type="password"
                  value={authConfig.password || ''}
                  onChange={(e) =>
                    updateNodeConfig(nodeId, {
                      authConfig: { ...authConfig, password: e.target.value },
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {authType === 'api-key' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={authConfig.keyName || ''}
                  onChange={(e) =>
                    updateNodeConfig(nodeId, {
                      authConfig: { ...authConfig, keyName: e.target.value },
                    })
                  }
                  placeholder={t.propertyPanel.httpKeyNamePlaceholder}
                  className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                />
                <input
                  type="password"
                  value={authConfig.keyValue || ''}
                  onChange={(e) =>
                    updateNodeConfig(nodeId, {
                      authConfig: { ...authConfig, keyValue: e.target.value },
                    })
                  }
                  placeholder={t.propertyPanel.httpKeyValuePlaceholder}
                  className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                />
              </div>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="addTo"
                    checked={authConfig.addTo !== 'query'}
                    onChange={() =>
                      updateNodeConfig(nodeId, {
                        authConfig: { ...authConfig, addTo: 'header' },
                      })
                    }
                  />
                  <span>{t.propertyPanel.httpSendInHeader}</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="addTo"
                    checked={authConfig.addTo === 'query'}
                    onChange={() =>
                      updateNodeConfig(nodeId, {
                        authConfig: { ...authConfig, addTo: 'query' },
                      })
                    }
                  />
                  <span>{t.propertyPanel.httpSendInQuery}</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {httpTab === 'settings' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase block">
                {t.propertyPanel.httpTimeoutLabel}
              </label>
              <input
                type="number"
                value={timeout}
                onChange={(e) =>
                  updateNodeConfig(nodeId, { timeout: parseInt(e.target.value, 10) || 30000 })
                }
                className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase block">
                {t.propertyPanel.httpMaxRetriesLabel}
              </label>
              <input
                type="number"
                min="0"
                max="5"
                value={maxRetries}
                onChange={(e) =>
                  updateNodeConfig(nodeId, {
                    retryConfig: {
                      maxRetries: parseInt(e.target.value, 10) || 0,
                      retryDelayMs,
                    },
                  })
                }
                className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
