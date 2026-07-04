import { appConfig } from '@/config/app.config';
import { complete, extractJson } from '@/lib/llm/client';
import { getDocument } from '@/lib/data/corpus';
import { toolByName } from '@/lib/tools';
import { computeConfidence } from './confidence';
import {
  DRAFTER_SYSTEM, INVESTIGATOR_SYSTEM, PLAN_SYSTEM, SKEPTIC_SYSTEM,
  investigateInstruction,
} from './prompts';
import type { AgentEventType, Memo, Objection, SkepticVerdict } from '@/lib/types';

export type Emit = (type: AgentEventType, title: string, detail?: string, payload?: unknown) => void;

interface InvestigateDecision {
  thought: string;
  action: string;
  args: Record<string, unknown>;
}

interface PlanResult {
  goal: string;
  steps: string[];
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + ` …[truncated ${s.length - n} chars]` : s);

/** Annotate each citation: is the quote a verbatim substring of the cited page? */
function verifyCitations(memo: Memo): { memo: Memo; verified: number; total: number } {
  let verified = 0;
  let total = 0;
  for (const f of memo.findings ?? []) {
    for (const c of f.citations ?? []) {
      total++;
      const page = getDocument(c.docId)?.pages.find((p) => p.n === c.page);
      c.verified = !!page && page.bodyText.toLowerCase().includes(c.quote.toLowerCase());
      if (c.verified) verified++;
    }
  }
  return { memo, verified, total };
}

export async function runAgent(arrivalDocId: string, emit: Emit): Promise<void> {
  const cfg = appConfig.agent;
  const doc = getDocument(arrivalDocId);
  if (!doc) {
    emit('error', `Unknown document ${arrivalDocId}`);
    return;
  }

  // Evidence tracked deterministically for the confidence score
  let usedCalcRatio = false;
  let readCovenantClause = false;
  let checkedAmendments = false;
  let objectionsRaised = 0;
  let toolResultCount = 0;

  emit('run_started', `Document arrived: ${doc.title}`, `${doc.pages.length} pages · dated ${doc.date} · Sentinel waking up`);

  // The investigation log is the single source of truth passed to every phase.
  let log =
    `NEW DOCUMENT ARRIVAL\n` +
    `Document: ${doc.title} (id: ${doc.id}, type: ${doc.type}, dated ${doc.date})\n\n` +
    doc.pages.map((p) => `--- page ${p.n}: ${clip(p.bodyText, 1600)}`).join('\n');

  // ---------- Phase 1: PLAN ----------
  emit('phase', 'Planning', 'Sentinel drafts its investigation plan');
  const plan = extractJson<PlanResult>(await complete('plan', [
    { role: 'system', content: PLAN_SYSTEM },
    { role: 'user', content: log },
  ]));
  emit('thought', 'Investigation plan', plan.goal, plan);
  log += `\n\nINVESTIGATION PLAN\nGoal: ${plan.goal}\nSteps: ${plan.steps.join(' | ')}`;

  // ---------- Phase 2/4: INVESTIGATE (shared by initial pass and objection resolution) ----------
  async function investigate(maxSteps: number, resolving: boolean): Promise<void> {
    for (let step = 0; step < maxSteps; step++) {
      const raw = await complete('investigate', [
        { role: 'system', content: INVESTIGATOR_SYSTEM },
        { role: 'user', content: `${log}\n\n${investigateInstruction(resolving)}` },
      ]);
      let decision: InvestigateDecision;
      try {
        decision = extractJson<InvestigateDecision>(raw);
      } catch {
        log += `\n\nNOTE: your previous reply was not valid JSON. Reply with exactly one JSON object.`;
        continue;
      }

      emit('thought', 'Sentinel reasons', decision.thought);
      log += `\n\nTHOUGHT: ${decision.thought}`;

      if (decision.action === 'draft_memo') return;

      const tool = toolByName(decision.action);
      if (!tool) {
        log += `\nERROR: unknown tool "${decision.action}". Available: search_documents, read_page, calc_ratio, query_ledger, draft_memo.`;
        emit('error', `Unknown tool requested: ${decision.action}`);
        continue;
      }

      emit('tool_call', `${tool.name}`, JSON.stringify(decision.args), { name: tool.name, args: decision.args });
      let result: unknown;
      try {
        result = tool.run(decision.args ?? {});
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
      }
      toolResultCount++;

      // Deterministic evidence flags
      if (tool.name === 'calc_ratio' && !(result as { error?: string }).error) usedCalcRatio = true;
      if (tool.name === 'read_page') {
        const r = result as { docId?: string; page?: number };
        const target = getDocument(String(r.docId ?? ''));
        if (r.docId === 'credit-agreement-2023' && r.page === 7) readCovenantClause = true;
        if (target?.type === 'amendment') checkedAmendments = true;
      }
      if (tool.name === 'search_documents' && (decision.args?.docType === 'amendment' ||
          String(decision.args?.query ?? '').toLowerCase().includes('amendment'))) {
        checkedAmendments = true;
      }

      const resultStr = JSON.stringify(result, null, 1);
      emit('tool_result', `${tool.name} → result`, clip(resultStr, 400), result);
      log += `\n\nTOOL CALL: ${tool.name} ${JSON.stringify(decision.args)}\nTOOL RESULT #${toolResultCount}:\n${clip(resultStr, cfg.maxObservationChars)}`;
    }
    log += `\n\nNOTE: step budget reached — draft the memo now with the evidence gathered.`;
  }

  emit('phase', 'Investigating', 'Multi-step evidence gathering: documents, ratios, ledger');
  await investigate(cfg.maxInvestigateSteps, false);

  // ---------- Phase 3: DRAFT ----------
  async function draft(label: string): Promise<Memo> {
    emit('phase', label, 'Writing memo from the investigation log');
    const memo = extractJson<Memo>(await complete('draft', [
      { role: 'system', content: DRAFTER_SYSTEM },
      { role: 'user', content: `${log}\n\nDraft the memo now.` },
    ]));
    const { verified, total } = verifyCitations(memo);
    emit('memo_draft', `Draft memo: ${memo.status}`,
      `${memo.findings?.length ?? 0} findings · ${verified}/${total} citations verified verbatim`, memo);
    log += `\n\nDRAFT MEMO:\n${JSON.stringify(memo, null, 1)}`;
    return memo;
  }

  let memo = await draft('Drafting memo');

  // ---------- Phase 4: SKEPTIC rounds ----------
  let verdict: SkepticVerdict | null = null;
  for (let round = 1; round <= cfg.maxSkepticRounds; round++) {
    emit('phase', `The Skeptic reviews (round ${round})`, 'Adversarial internal challenge before anything reaches a human');
    verdict = extractJson<SkepticVerdict>(await complete('skeptic', [
      { role: 'system', content: SKEPTIC_SYSTEM },
      { role: 'user', content: `INVESTIGATION LOG AND DRAFT MEMO:\n${log}` },
    ]));

    if (verdict.verdict === 'approved' || (verdict.objections ?? []).length === 0) {
      emit('skeptic_verdict', 'The Skeptic approves', 'Memo survives the adversarial checklist', verdict);
      break;
    }

    objectionsRaised += verdict.objections.length;
    for (const o of verdict.objections) {
      emit('skeptic_objection', `Objection ${o.id}: ${o.target}`, o.objection, o);
    }
    log += `\n\nOUTSTANDING OBJECTIONS (from internal reviewer — resolve ALL before redrafting):\n` +
      verdict.objections.map((o: Objection) => `${o.id} [${o.target}] ${o.objection}\n  Required: ${o.requiredAction}`).join('\n');

    emit('phase', 'Resolving objections', 'Sentinel goes back to the evidence');
    await investigate(cfg.maxResolutionSteps, true);
    memo = await draft('Redrafting memo');
    emit('resolution_note', 'Objections addressed', 'Memo revised in light of new evidence');
  }

  // ---------- Phase 5: Confidence + final ----------
  const confidence = computeConfidence({
    usedCalcRatio,
    readCovenantClause,
    checkedAmendments,
    skepticFinalVerdict: verdict?.verdict ?? null,
    objectionsRaised,
    memo,
  });
  emit('confidence', `Confidence ${(confidence.total * 100).toFixed(0)}%`,
    'Deterministic score computed from what the agent actually verified', confidence);

  emit('memo_final', `Final memo: ${memo.status}`, memo.title, { memo, confidence });
  emit('done', 'Run complete');
}
