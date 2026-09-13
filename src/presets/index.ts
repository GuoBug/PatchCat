import customerSupportEn from './en/customer-support-routing.json' with { type: 'json' };
import reportCriticEn from './en/report-generation-critic.json' with { type: 'json' };
import modelArenaEn from './en/model-arena-eval.json' with { type: 'json' };
import ragKnowledgeQaEn from './en/rag-knowledge-qa.json' with { type: 'json' };
import ragAgenticAuditorEn from './en/rag-agentic-auditor.json' with { type: 'json' };
import conditionalRoutingEn from './en/conditional-customer-routing.json' with { type: 'json' };
import weatherApiEn from './en/weather-api-integration.json' with { type: 'json' };
import agentToolCallingEn from './en/agent-tool-calling.json' with { type: 'json' };

import customerSupportZh from './zh/customer-support-routing.json' with { type: 'json' };
import reportCriticZh from './zh/report-generation-critic.json' with { type: 'json' };
import modelArenaZh from './zh/model-arena-eval.json' with { type: 'json' };
import ragKnowledgeQaZh from './zh/rag-knowledge-qa.json' with { type: 'json' };
import ragAgenticAuditorZh from './zh/rag-agentic-auditor.json' with { type: 'json' };
import conditionalRoutingZh from './zh/conditional-customer-routing.json' with { type: 'json' };
import weatherApiZh from './zh/weather-api-integration.json' with { type: 'json' };
import agentToolCallingZh from './zh/agent-tool-calling.json' with { type: 'json' };

import type { WorkflowGraph } from '../engine/types.ts';
import type { Language } from '../i18n/translations.ts';

export interface PresetItem {
  key: string;
  name: string;
  desc: string;
  data: WorkflowGraph;
}

export const PRESETS_DATA: Record<Language, Record<string, PresetItem>> = {
  en: {
    'customer-support': {
      key: 'customer-support',
      name: 'Customer Support Routing',
      desc: 'Intent Classification & Ticket Dispatch',
      data: customerSupportEn as unknown as WorkflowGraph,
    },
    'report-critic': {
      key: 'report-critic',
      name: 'Report Generator with Critic',
      desc: 'Self-Reflective Multi-Agent Loop',
      data: reportCriticEn as unknown as WorkflowGraph,
    },
    'model-arena': {
      key: 'model-arena',
      name: 'Multi-LLM Arena & Judge',
      desc: 'Side-by-Side Model Benchmark',
      data: modelArenaEn as unknown as WorkflowGraph,
    },
    'rag-qa': {
      key: 'rag-qa',
      name: 'RAG Grounded Q&A',
      desc: 'Knowledge Base Retrieval & Grounded Answer',
      data: ragKnowledgeQaEn as unknown as WorkflowGraph,
    },
    'rag-agentic-auditor': {
      key: 'rag-agentic-auditor',
      name: 'Enterprise RAG: Proposal & Compliance Auditor',
      desc: 'Dual-Stage Agentic RAG with Grounded Fact-Checking',
      data: ragAgenticAuditorEn as unknown as WorkflowGraph,
    },
    'conditional-routing': {
      key: 'conditional-routing',
      name: 'Conditional Customer Routing',
      desc: 'IF/ELSE Branch Routing & Aggregation',
      data: conditionalRoutingEn as unknown as WorkflowGraph,
    },
    'weather-api': {
      key: 'weather-api',
      name: 'Weather API Integration',
      desc: 'External HTTP Request & Advisory Summary',
      data: weatherApiEn as unknown as WorkflowGraph,
    },
    'agent-tool-calling': {
      key: 'agent-tool-calling',
      name: 'Autonomous Agent with Tool Calling',
      desc: 'ReAct Agent with Lookup & Calculation Tools',
      data: agentToolCallingEn as unknown as WorkflowGraph,
    },
  },
  zh: {
    'customer-support': {
      key: 'customer-support',
      name: '智能客服意图识别与工单路由',
      desc: '意图多维分析与智能派单链路',
      data: customerSupportZh as unknown as WorkflowGraph,
    },
    'report-critic': {
      key: 'report-critic',
      name: '自反思研报生成与 Critic 优化',
      desc: '初稿生成 + 专家评审 + 终稿润色',
      data: reportCriticZh as unknown as WorkflowGraph,
    },
    'model-arena': {
      key: 'model-arena',
      name: '多大模型横向盲测与裁判打分',
      desc: '多模型并发评测与 LLM-as-a-Judge',
      data: modelArenaZh as unknown as WorkflowGraph,
    },
    'rag-qa': {
      key: 'rag-qa',
      name: 'RAG 知识库增强精准问答',
      desc: '私有文档向量语义检索与引文回答',
      data: ragKnowledgeQaZh as unknown as WorkflowGraph,
    },
    'rag-agentic-auditor': {
      key: 'rag-agentic-auditor',
      name: '知识库增强方案生成与合规质检流',
      desc: '切片召回 ➔ 方案生成 ➔ 知识库基准质检 ➔ 终审定稿',
      data: ragAgenticAuditorZh as unknown as WorkflowGraph,
    },
    'conditional-routing': {
      key: 'conditional-routing',
      name: '智能客服多分支条件路由与聚合',
      desc: '多路分支动态跳过与结果汇聚',
      data: conditionalRoutingZh as unknown as WorkflowGraph,
    },
    'weather-api': {
      key: 'weather-api',
      name: '外部实时天气 API 调度与总结',
      desc: '三方 HTTP 接口请求与早报播报',
      data: weatherApiZh as unknown as WorkflowGraph,
    },
    'agent-tool-calling': {
      key: 'agent-tool-calling',
      name: '自主智能体工具调用与运算流',
      desc: 'ReAct 自主循环调用汇率与运算工具',
      data: agentToolCallingZh as unknown as WorkflowGraph,
    },
  },
};

export {
  customerSupportEn,
  reportCriticEn,
  modelArenaEn,
  ragKnowledgeQaEn,
  ragAgenticAuditorEn,
  conditionalRoutingEn,
  weatherApiEn,
  agentToolCallingEn,
  customerSupportZh,
  reportCriticZh,
  modelArenaZh,
  ragKnowledgeQaZh,
  ragAgenticAuditorZh,
  conditionalRoutingZh,
  weatherApiZh,
  agentToolCallingZh,
};
