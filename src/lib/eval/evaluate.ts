import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { appConfig } from '@/config/app.config';
import type {
  AgentEvent, Citation, EvalCheck, Memo, RatioResult, RunUsage, ScenarioEval,
} from '@/lib/types';
import { GROUND_TRUTH, type ScenarioGroundTruth } from './groundTruth';

const RUNS_DIR = join(process.cwd(), appConfig.paths.dataDir, 'runs');

export function loadRun(docId: string): AgentEvent[] | null {
  const file = join(RUNS_DIR, `last-run-${docId}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf-8')) as AgentEvent[];
}

export function finalMemoOf(events: AgentEvent[]): { memo: Memo; skepticApproved: boolean; usage?: RunUsage } | null {
  const fin = [...events].reverse().find((e) => e.type === 'memo_final');
  if (!fin) return null;
  const p = fin.payload as { memo: Memo; usage?: RunUsage; skepticApproved?: boolean };
  return { memo: p.memo, skepticApproved: p.skepticApproved ?? false, usage: p.usage };
}

function citationsOf(memo: Memo): Citation[] {
  return (memo.findings ?? []).flatMap((f) => f.citations ?? []);
}

/** Score one scenario's last saved run against the generated ground truth. */
export function evaluateScenario(gt: ScenarioGroundTruth): ScenarioEval {
  const events = loadRun(gt.docId);
  if (!events) {
    return { docId: gt.docId, label: gt.label, hasRun: false, checks: [], score: 0 };
  }
  const fin = finalMemoOf(events);
  if (!fin) {
    return {
      docId: gt.docId, label: gt.label, hasRun: true, score: 0,
      checks: [{ id: 'final', label: 'Run produced a final memo', passed: false, detail: 'No memo_final event in the saved run.' }],
    };
  }
  const { memo, skepticApproved, usage } = fin;
  const checks: EvalCheck[] = [];

  // 1. Verdict against ground truth
  checks.push({
    id: 'verdict',
    label: 'Correct verdict',
    passed: memo.status === gt.expectedStatus,
    detail: `expected ${gt.expectedStatus}, memo says ${memo.status}`,
  });

  // 2. Leverage recomputed deterministically, with the exact ground-truth value
  const ratioResults = events
    .filter((e) => e.type === 'tool_result')
    .map((e) => e.payload as RatioResult)
    .filter((r) => r && r.metric === 'leverage' && r.period?.toLowerCase() === gt.quarter.toLowerCase());
  const leverageOk = ratioResults.some((r) => Math.abs(r.value - gt.expectedLeverage) < 0.005);
  checks.push({
    id: 'ratio',
    label: `Leverage recomputed via calc_ratio (${gt.expectedLeverage}x)`,
    passed: leverageOk,
    detail: ratioResults.length
      ? `calc_ratio returned ${ratioResults.map((r) => r.value + 'x').join(', ')}`
      : 'calc_ratio was never called for the tested quarter',
  });

  // 3. Every citation in the final memo verified verbatim against its source page
  const cites = citationsOf(memo);
  const verified = cites.filter((c) => c.verified).length;
  checks.push({
    id: 'citations',
    label: 'All citations verified verbatim',
    passed: cites.length > 0 && verified === cites.length,
    detail: `${verified}/${cites.length} verbatim against source pages`,
  });

  // 4. Amendment awareness (the trap of the whole exercise)
  if (gt.mustCheckAmendment) {
    const citedAmendment = cites.some((c) => c.docId === 'amendment-2');
    const touchedAmendment = events.some(
      (e) =>
        (e.type === 'tool_call' || e.type === 'tool_result') &&
        JSON.stringify(e.payload ?? '').includes('amendment-2'),
    );
    checks.push({
      id: 'amendment',
      label: 'Amendment No. 2 (covenant holiday) found and used',
      passed: citedAmendment || touchedAmendment,
      detail: citedAmendment ? 'cited in the memo' : touchedAmendment ? 'read during investigation' : 'never touched — threshold basis unreliable',
    });
  }

  // 5. Material one-off movements carried in the memo (matched or unexplained)
  if (gt.requiredFlaggedIds.length > 0) {
    const flagged = new Set((memo.flaggedTransactions ?? []).map((t) => t.id));
    const missing = gt.requiredFlaggedIds.filter((id) => !flagged.has(id));
    checks.push({
      id: 'materiality',
      label: 'All material one-off movements carried',
      passed: missing.length === 0,
      detail: missing.length === 0 ? `${gt.requiredFlaggedIds.length}/${gt.requiredFlaggedIds.length} present` : `missing: ${missing.join(', ')}`,
    });
  }

  // 6. Adversarial review actually happened and signed off
  const skepticEngaged = events.some((e) => e.type === 'skeptic_verdict' || e.type === 'skeptic_objection');
  checks.push({
    id: 'skeptic',
    label: 'Skeptic review completed and approved',
    passed: skepticEngaged && skepticApproved,
    detail: !skepticEngaged ? 'no Skeptic activity in the run' : skepticApproved ? 'approved' : 'reservations left open',
  });

  const score = checks.filter((c) => c.passed).length / checks.length;
  const durationSec = (events[events.length - 1].ts - events[0].ts) / 1000;
  const file = join(RUNS_DIR, `last-run-${gt.docId}.json`);
  const runAgeMinutes = Math.round((Date.now() - statSync(file).mtimeMs) / 60_000);

  return {
    docId: gt.docId,
    label: gt.label,
    hasRun: true,
    runAgeMinutes,
    checks,
    score,
    durationSec: Math.round(durationSec),
    costUsd: usage?.totalCostUsd,
    totalTokens: usage?.totalTokens,
  };
}

export function evaluateAll(): ScenarioEval[] {
  return GROUND_TRUTH.map(evaluateScenario);
}
