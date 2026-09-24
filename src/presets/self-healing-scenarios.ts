import { z } from 'zod';
import type { ZodSchemaConfig } from '../engine/types.ts';
import { registerSchema } from '../engine/structured-output.ts';

/**
 * Advanced Semantic & Cross-Field Business Invariant Schema for Customer Support Ticket Triage.
 * Used in presets and evaluation for L2 validation and multi-round self-healing when L1 passes.
 */
export const TicketSemanticSchema = z
  .object({
    urgency: z.number().int().min(1).max(5).describe('工单紧急度 1..5'),
    category: z.enum(['logistics', 'refund', 'quality', 'other']).describe('工单类别'),
    summary: z.string().min(5).max(30).describe('问题摘要（严格限制在 5-30 字内）'),
    orderId: z
      .string()
      .regex(/^ORD-\d{6}$/, '订单号格式必须为 ORD-xxxxxx（形如 ORD-123456）')
      .describe('从文本中提取的订单号，形如 ORD-123456'),
  })
  .refine((d) => !(d.category === 'refund' && d.urgency < 4), {
    message: '业务红线：退款类工单涉及资金流转，urgency 必须 ≥ 4',
    path: ['urgency'],
    params: { crossFields: ['category', 'urgency'] },
  })
  .refine((d) => !(d.urgency >= 4 && d.summary.length < 15), {
    message: '合规要求：高优先级工单 (urgency ≥ 4) 的 summary 至少需要 15 字阐述详情理由',
    path: ['summary'],
    params: { crossFields: ['urgency', 'summary'] },
  })
  // ── 跨字段契约 C1: summary × orderId（订单号只允许出现在 orderId 字段）────────────
  .refine((d) => !/ORD[-\s]?\d{4,}/i.test(d.summary), {
    message: '跨字段契约：订单号只允许出现在 orderId 字段，summary 中不得复述任何订单号',
    path: ['summary'],
    params: { crossFields: ['summary', 'orderId'] },
  })
  // ── 跨字段契约 C2: urgency × category（物流类不占用高优先级处理通道）─────────────
  .refine((d) => !(d.category === 'logistics' && d.urgency > 3), {
    message: '跨字段契约：物流类工单不涉及资金流转，urgency 必须 ≤ 3',
    path: ['urgency'],
    params: { crossFields: ['category', 'urgency'] },
  });

// Register TicketSemanticSchema into engine's schema registry dynamically
registerSchema('TicketSemanticSchema', TicketSemanticSchema);

export type LLMTestScenario =
  | 'valid'
  | 'missing_field'
  | 'enum_out_of_bounds'
  | 'token_truncated'
  | 'empty_output'
  | 'three_failures'
  | 'semantic_refine_violation'
  | 'custom';

export interface TestScenarioDefinition {
  id: LLMTestScenario;
  name: string;
  description: string;
  schemaConfig: ZodSchemaConfig;
  defaultResponses: string[];
  defaultFinishReasons?: string[];
  expectedOutcome: string;
}

export const TEST_SCENARIOS: Record<LLMTestScenario, TestScenarioDefinition> = {
  valid: {
    id: 'valid',
    name: '1. Schema 完全合法 → 直接通过',
    description: '模型一次性输出符合约束的合法 JSON，直接通过校验，0 次自愈重试',
    schemaConfig: {
      name: 'TicketVerification',
      fields: {
        urgency: { type: 'number', min: 1, max: 5, description: '工单紧急度 1..5' },
        summary: { type: 'string', minLength: 5, description: '工单摘要至少5字符' },
      },
    },
    defaultResponses: [
      JSON.stringify({ urgency: 4, summary: '生产数据库偶发连接超时，正在排查中' }),
    ],
    defaultFinishReasons: ['stop'],
    expectedOutcome: '直接通过校验，不触发自愈修复 (attempts: 1)',
  },
  missing_field: {
    id: 'missing_field',
    name: '2. 缺必填字段 → 修复第 1 次成功',
    description: '第 1 轮缺少必填 summary 字段被 L2 拦截，回喂字段级错误记忆后，第 2 轮补全字段修复成功',
    schemaConfig: {
      name: 'TicketVerification',
      fields: {
        urgency: { type: 'number', min: 1, max: 5, description: '工单紧急度 1..5' },
        summary: { type: 'string', minLength: 5, description: '工单摘要至少5字符' },
      },
    },
    defaultResponses: [
      JSON.stringify({ urgency: 4 }), // missing summary
      JSON.stringify({ urgency: 4, summary: '已补全摘要：线上支付网关发生延迟并已恢复' }),
    ],
    defaultFinishReasons: ['stop', 'stop'],
    expectedOutcome: '第 1 轮拦截缺失字段 -> 回喂记忆 -> 第 2 轮修正成功',
  },
  enum_out_of_bounds: {
    id: 'enum_out_of_bounds',
    name: '3. enum/数值越界 (1..5 给 9) → 被 L2 拦住',
    description: '模型输出 urgency: 9（数字语法合法，L1放行），被 L2 safeParse 领域防线精确阻断，自愈修正为 5',
    schemaConfig: {
      name: 'TicketVerification',
      fields: {
        urgency: { type: 'number', min: 1, max: 5, description: '紧急度只能在 1..5' },
        summary: { type: 'string', minLength: 5, description: '摘要不少于5字符' },
      },
    },
    defaultResponses: [
      JSON.stringify({ urgency: 9, summary: '服务器机房空调过热报警' }), // urgency 9 > 5
      JSON.stringify({ urgency: 5, summary: '服务器机房空调过热报警（已纠偏至允许最高值5）' }),
    ],
    defaultFinishReasons: ['stop', 'stop'],
    expectedOutcome: '证明 L1 语法不够，L2 精准截获 [urgency] 越界并回喂自愈',
  },
  token_truncated: {
    id: 'token_truncated',
    name: '4. 输出被 max_tokens 截断 ➔ 紧凑自愈重试成功',
    description: '第 1 轮输出因达到 Token 长度被物理截断；状态机特异性走截断分支，注入紧凑压缩处方，第 2 轮紧凑输出自愈成功',
    schemaConfig: {
      name: 'TicketVerification',
      fields: {
        urgency: { type: 'number', min: 1, max: 5 },
        summary: { type: 'string', minLength: 5 },
      },
    },
    defaultResponses: [
      '{"urgency": 3, "summary": "由于系统内存溢出，节点正在发生阶段性',
      JSON.stringify({ urgency: 3, summary: '内存溢出排查已完成，已恢复正常' }),
    ],
    defaultFinishReasons: ['length', 'stop'],
    expectedOutcome: '走截断特异性分支 -> 注入紧凑压缩处方 -> 第 2 轮修正成功 (healedFromTruncation: true)',
  },
  empty_output: {
    id: 'empty_output',
    name: '5. 输出为空 → 原地干净重试 (DeepSeek 空包坑)',
    description: '模型偶发吐出空响应，状态机原地无污染重发原始请求（不注入虚假的校验报错记忆），第 2 轮成功输出',
    schemaConfig: {
      name: 'TicketVerification',
      fields: {
        urgency: { type: 'number', min: 1, max: 5 },
        summary: { type: 'string', minLength: 5 },
      },
    },
    defaultResponses: [
      '', // empty
      JSON.stringify({ urgency: 2, summary: '重试后正常响应：客户咨询升级计划' }),
    ],
    defaultFinishReasons: ['stop', 'stop'],
    expectedOutcome: '原地干净重发原始请求，不污染上下文历史',
  },
  three_failures: {
    id: 'three_failures',
    name: '6. 连续 3 次失败 → 阶梯递进升级并优雅降级',
    description: 'R1 给出字段级手术刀处方；R2 识别同构微调并升级为全量 Schema 与黄金示例灌顶；3 次耗尽后优雅降级不抛错',
    schemaConfig: {
      name: 'TicketVerification',
      fields: {
        urgency: { type: 'number', min: 1, max: 5 },
        summary: { type: 'string', minLength: 5 },
      },
    },
    defaultResponses: [
      JSON.stringify({ urgency: 99, summary: '' }),
      JSON.stringify({ urgency: 88, summary: 'abc' }),
      JSON.stringify({ urgency: 77, summary: 'xyz' }),
    ],
    defaultFinishReasons: ['stop', 'stop', 'stop'],
    expectedOutcome: '三轮反馈逐级升级 (R1手术刀->R2黄金示例)，预算耗尽后优雅降级输出 _validationFailed',
  },
  semantic_refine_violation: {
    id: 'semantic_refine_violation',
    name: '7. 跨字段业务契约拦截 (Refine Invariant Violation)',
    description: '受限解码(L1)放行，被 L2 Zod .refine() 拦截跨字段业务冲突（refund 但 urgency < 4；高优先级 summary < 15 字），经状态机处方精准自愈',
    schemaConfig: {
      name: 'TicketSemanticSchema',
      fields: {
        urgency: { type: 'number', min: 1, max: 5, description: '工单紧急度 1..5' },
        category: { type: 'enum', enum: ['logistics', 'refund', 'quality', 'other'], description: '工单类别' },
        summary: { type: 'string', minLength: 5, maxLength: 30, description: '问题摘要(5-30字)' },
        orderId: { type: 'string', description: '订单号 ORD-123456' },
      },
      schema: TicketSemanticSchema,
    },
    defaultResponses: [
      JSON.stringify({ urgency: 2, category: 'refund', summary: '键盘空格键失灵申请退款', orderId: 'ORD-882310' }),
      JSON.stringify({ urgency: 4, category: 'refund', summary: '键盘空格键硬件失灵故障，用户申请退款并寄回处理', orderId: 'ORD-882310' }),
    ],
    defaultFinishReasons: ['stop', 'stop'],
    expectedOutcome: 'L1语法通过 -> L2截获业务跨字段冲突 -> 注入三要素处方 -> 第2轮自愈成功',
  },
  custom: {
    id: 'custom',
    name: '自定义测试场景',
    description: '自定义多轮模型输出与校验规则',
    schemaConfig: {
      name: 'CustomSchema',
      fields: {
        urgency: { type: 'number', min: 1, max: 5 },
        summary: { type: 'string', minLength: 5 },
      },
    },
    defaultResponses: [],
    expectedOutcome: '用户自定义响应序列与校验模式',
  },
};

export function getTestScenario(id: string): TestScenarioDefinition | undefined {
  return TEST_SCENARIOS[id as LLMTestScenario];
}
