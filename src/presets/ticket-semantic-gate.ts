/**
 * @file    src/presets/ticket-semantic-gate.ts
 * @description
 *   Domain-specific Semantic Conflict Gate for E-Commerce Customer Support Workflows.
 *   Implements ISemanticConflictGate for F7 (Description-Action Priority Inversion).
 *
 *   Architectural Principle:
 *   "引擎认接口，preset 认业务" (Engine recognizes interfaces, preset owns domain logic).
 *   This separates business vocabulary (假货, 退款, refund, quality) from core engine code.
 */

import type { ISemanticConflictGate, SemanticConflictResult } from '../engine/model-router.ts';

/** Strong symptom / defect terms that commonly anchor LLM attention */
export const TICKET_SYMPTOM_TERMS: readonly string[] = [
  '假货', '仿冒', '伪劣', '大牌假货', '假冒伪劣', '做工粗糙',
  '破损', '暗损', '大裂缝', '贯穿性', '压扁', '碎了', '质量太次', '质量问题',
  '划痕', '漏发', '少配件', '少件', '瑕疵',
];

/** Explicit core action request terms (refund/return) that take precedence */
export const TICKET_ACTION_REFUND_TERMS: readonly string[] = [
  '退款', '退货', '退货退款', '要求退款', '立即退款', '我要退款',
  '帮忙退', '申请退款', '全额退款', '退钱', '退货赔付',
];

export class TicketSemanticConflictGate implements ISemanticConflictGate {
  readonly symptomTerms: readonly string[];
  readonly actionRefundTerms: readonly string[];

  constructor(
    symptomTerms: readonly string[] = TICKET_SYMPTOM_TERMS,
    actionRefundTerms: readonly string[] = TICKET_ACTION_REFUND_TERMS,
  ) {
    this.symptomTerms = symptomTerms;
    this.actionRefundTerms = actionRefundTerms;
  }

  evaluate(userPrompt?: string, outputData?: unknown): SemanticConflictResult {
    if (!userPrompt || typeof outputData !== 'object' || outputData === null) {
      return { hasConflict: false, detectedTerms: [] };
    }

    const promptText = userPrompt.toLowerCase();
    const detectedSymptomTerms = this.symptomTerms.filter((term) =>
      promptText.includes(term.toLowerCase()),
    );
    const detectedActionTerms = this.actionRefundTerms.filter((term) =>
      promptText.includes(term.toLowerCase()),
    );

    const category = (outputData as Record<string, unknown>)['category'];

    // F7: Prompt has strong defect details AND explicit refund action, but output category is 'quality' or 'other'
    if (detectedSymptomTerms.length > 0 && detectedActionTerms.length > 0) {
      if (category === 'quality' || category === 'other') {
        const detected = [...detectedSymptomTerms, ...detectedActionTerms];
        return {
          hasConflict: true,
          conflictType: 'f7_description_action_inversion',
          reason: `工单同时包含浓重缺陷描述 (${detectedSymptomTerms.join('/')}) 与核心退款诉求 (${detectedActionTerms.join('/')})，模型受前置细节锚定误判为 "${String(category)}"，触发动作优先权 (Action Precedence) 语义门禁！`,
          suggestedAction: 'refund',
          suggestedCategory: 'refund',
          detectedTerms: detected,
          detectedSymptomTerms,
          detectedActionTerms,
          directive:
            '[业务动作优先权消歧指令 / Action Precedence Disambiguation Directive]\n系统检测到工单包含强烈的退款退货诉求，而上一轮经济模型受商品瑕疵细节误导。请务必以用户最终诉求动作作为第一判据，优先归类为 refund！',
        };
      }
    }

    return {
      hasConflict: false,
      detectedTerms: [...detectedSymptomTerms, ...detectedActionTerms],
      detectedSymptomTerms,
      detectedActionTerms,
    };
  }
}

/** Default singleton instance for preset usage */
export const defaultTicketSemanticGate = new TicketSemanticConflictGate();

/**
 * Functional helper for testing and direct invocation.
 */
export function detectTicketSemanticConflict(
  userPrompt?: string,
  outputData?: unknown,
): SemanticConflictResult {
  return defaultTicketSemanticGate.evaluate(userPrompt, outputData);
}
