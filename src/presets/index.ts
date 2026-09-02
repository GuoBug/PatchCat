import customerSupportEn from './en/customer-support-routing.json';
import reportCriticEn from './en/report-generation-critic.json';
import modelArenaEn from './en/model-arena-eval.json';

import customerSupportZh from './zh/customer-support-routing.json';
import reportCriticZh from './zh/report-generation-critic.json';
import modelArenaZh from './zh/model-arena-eval.json';

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
  },
};

export {
  customerSupportEn,
  reportCriticEn,
  modelArenaEn,
  customerSupportZh,
  reportCriticZh,
  modelArenaZh,
};
