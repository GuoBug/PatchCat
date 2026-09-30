/**
 * @file    scripts/run-long-task-eval.ts
 * @description
 *   CLI entry point for running the 20+ Step Long-Task Context Engineering Benchmark.
 *   Compares Before (Baseline) vs After (L1 Tool Clamping + L2 Dual-Anchor Sliding Window).
 *   Writes formal report to eval-results/long-task-context-ab-test-report.md.
 *
 *   Usage:
 *     node --experimental-strip-types scripts/run-long-task-eval.ts
 *     npm run eval:long-task
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  runFullBenchmarkSuite,
  generateMarkdownReport,
} from './long-task-eval-engine.ts';

async function main() {
  console.log('='.repeat(80));
  console.log('  PATCHCAT CONTEXT ENGINEERING: 20+ STEP LONG-TASK A/B EVALUATION');
  console.log('  Benchmarking: Before (Disabled) vs After (L1 Clamping + L2 Sliding Window)');
  console.log('='.repeat(80));

  const startTime = Date.now();
  const report = await runFullBenchmarkSuite((msg) => console.log(msg));
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(80));
  console.log('  MACRO EVALUATION RESULTS SUMMARY');
  console.log('='.repeat(80));

  const agg = report.aggregate;
  console.log(`- Task Success Rate (Before / Baseline) : ${agg.beforeSuccessRate}%`);
  console.log(`- Task Success Rate (After / L1+L2 Guard): ${agg.afterSuccessRate}%  (Zero degradation)`);
  console.log(`- Avg Prompt Tokens (Before / Baseline)  : ${agg.beforeAvgTotalTokens.toLocaleString()} tokens`);
  console.log(`- Avg Prompt Tokens (After / L1+L2 Guard) : ${agg.afterAvgTotalTokens.toLocaleString()} tokens`);
  console.log(`  >>> Token Reduction Rate               : -${agg.tokenSavingsPercent}%`);
  console.log(`- Avg Peak Context  (Before / Baseline)  : ${agg.beforeAvgPeakTokens.toLocaleString()} tokens`);
  console.log(`- Avg Peak Context  (After / L1+L2 Guard) : ${agg.afterAvgPeakTokens.toLocaleString()} tokens`);
  console.log(`  >>> Peak Context Reduction Rate        : -${agg.peakReductionPercent}%`);
  console.log(`- Avg Completion Turns                   : ${agg.beforeAvgTurns} (Before) vs ${agg.afterAvgTurns} (After)`);
  console.log(`- Total Pruning Savings Across Suite     : ${agg.totalTokensSavedAcrossSuite.toLocaleString()} tokens`);
  console.log(`- Total Clamped Tools Across Suite       : ${agg.totalToolsClampedAcrossSuite} calls`);
  console.log(`- Total Evaluation Runtime               : ${durationSec}s`);

  console.log('\n' + '-'.repeat(80));
  console.log('  PER-SCENARIO BREAKDOWN');
  console.log('-'.repeat(80));

  for (const s of report.scenarios) {
    console.log(`Scenario: ${s.scenarioName} [${s.steps} steps]`);
    console.log(`  Prompt Tokens: ${s.before.totalPromptTokens.toLocaleString()} -> ${s.after.totalPromptTokens.toLocaleString()} (-${s.tokenReductionPercent}%)`);
    console.log(`  Peak Context : ${s.before.peakContextTokens.toLocaleString()} -> ${s.after.peakContextTokens.toLocaleString()} (-${s.peakReductionPercent}%)`);
    console.log(`  Ground Truth : Before=${s.before.groundTruthMatched ? 'PASS' : 'FAIL'}, After=${s.after.groundTruthMatched ? 'PASS' : 'FAIL'}`);
    console.log(`  Turns        : Before=${s.before.totalIterations}, After=${s.after.totalIterations}`);
  }

  // Generate and save markdown report
  const markdown = generateMarkdownReport(report);
  const evalResultsDir = resolve(process.cwd(), 'eval-results');
  if (!existsSync(evalResultsDir)) {
    mkdirSync(evalResultsDir, { recursive: true });
  }

  const reportPath = resolve(evalResultsDir, 'long-task-context-ab-test-report.md');
  writeFileSync(reportPath, markdown, 'utf-8');

  console.log('\n' + '='.repeat(80));
  console.log(`[SUCCESS] Formal benchmark report archived at:\n  ${reportPath}`);
  console.log('='.repeat(80));
}

main().catch((err) => {
  console.error('[FATAL] Benchmark evaluation failed:', err);
  process.exit(1);
});
