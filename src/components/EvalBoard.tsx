'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { JudgeResult, ScenarioEval } from '@/lib/types';

const shortModel = (id: string) => id.split('/').pop() ?? id;

function ScoreRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tone = pct === 100 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600';
  return <span className={`font-mono text-2xl font-bold ${tone}`}>{pct}%</span>;
}

function ScenarioCard({ ev }: { ev: ScenarioEval }) {
  const [judge, setJudge] = useState<JudgeResult | null>(null);
  const [judging, setJudging] = useState(false);
  const [judgeError, setJudgeError] = useState<string | null>(null);

  const runJudge = useCallback(async () => {
    setJudging(true);
    setJudgeError(null);
    try {
      const r = await fetch(`/api/eval/judge?docId=${ev.docId}`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      setJudge(data as JudgeResult);
    } catch (e) {
      setJudgeError(e instanceof Error ? e.message : String(e));
    } finally {
      setJudging(false);
    }
  }, [ev.docId]);

  if (!ev.hasRun) {
    return (
      <div className="rounded-xl border border-slate-300 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-900">{ev.label}</h3>
        <p className="mt-2 text-xs text-slate-500">
          No saved run yet — trigger this scenario from the workbench inbox first.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{ev.label}</h3>
          <p className="mt-0.5 text-[10px] text-slate-500">
            last live run {ev.runAgeMinutes} min ago
            {ev.durationSec != null && <> · {ev.durationSec}s</>}
            {ev.totalTokens != null && <> · {ev.totalTokens.toLocaleString('en-US')} tokens</>}
            {ev.costUsd != null && <> · ${ev.costUsd.toFixed(4)}</>}
          </p>
        </div>
        <ScoreRing score={ev.score} />
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {ev.checks.map((c) => (
          <div key={c.id} className={`rounded-lg border px-2.5 py-1.5 ${c.passed ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-semibold ${c.passed ? 'text-emerald-800' : 'text-red-800'}`}>
                {c.passed ? '✓' : '✗'} {c.label}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-600">{c.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">
        {judge ? (
          <div className="rounded-lg border border-violet-300 bg-violet-50 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
                LLM-as-judge · {shortModel(judge.model)}
              </span>
              <span className="font-mono text-xs font-bold text-violet-800">
                faithfulness {judge.faithfulness} · completeness {judge.completeness}
              </span>
            </div>
            {judge.comments.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {judge.comments.map((c, i) => (
                  <li key={i} className="text-[10px] leading-relaxed text-slate-700">— {c}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <button
            onClick={runJudge}
            disabled={judging}
            className="w-full rounded-lg border border-violet-300 bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            {judging ? '⏳ Judging on Vultr…' : '⚖️ Run LLM-as-judge (independent model)'}
          </button>
        )}
        {judgeError && <p className="mt-1.5 text-[10px] text-red-600">{judgeError}</p>}
      </div>
    </div>
  );
}

export function EvalBoard() {
  const [evals, setEvals] = useState<ScenarioEval[] | null>(null);

  const refresh = useCallback(() => {
    fetch('/api/eval').then((r) => r.json()).then((d) => setEvals(d.scenarios));
  }, []);
  useEffect(refresh, [refresh]);

  const withRuns = (evals ?? []).filter((e) => e.hasRun);
  const overall = withRuns.length
    ? withRuns.reduce((s, e) => s + e.score, 0) / withRuns.length
    : null;

  return (
    <div className="min-h-screen bg-slate-200">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xl">⚖️</span>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-white">Evaluation harness — Covenant Sentinel</h1>
            <p className="text-[11px] text-slate-400">
              Deterministic ground-truth scoring of the agent&apos;s actual runs + independent LLM-as-judge
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {overall != null && (
            <span className="rounded-full border border-emerald-400/60 bg-emerald-400/20 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-200">
              overall {Math.round(overall * 100)}%
            </span>
          )}
          <button
            onClick={refresh}
            className="rounded-full border border-slate-600 bg-slate-800 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300 transition-colors hover:bg-slate-700"
          >
            ↺ Refresh
          </button>
          <Link
            href="/"
            className="rounded-full border border-sky-400/50 bg-sky-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-sky-300 transition-colors hover:bg-sky-400/25"
          >
            ← Workbench
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-5">
        <p className="mb-4 rounded-lg border border-slate-300 bg-white p-3 text-xs leading-relaxed text-slate-600">
          The corpus is generated by script with <span className="font-semibold text-slate-800">known ground truth</span> —
          so every run can be scored objectively: did the agent reach the correct verdict, recompute the exact ratio,
          find the amendment, verify its citations, carry all material movements, and survive the Skeptic?
          The LLM-as-judge (a model absent from the production pipeline) independently scores faithfulness and completeness of the final memo, on Vultr.
        </p>
        {!evals ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {evals.map((ev) => <ScenarioCard key={ev.docId} ev={ev} />)}
          </div>
        )}
      </main>
    </div>
  );
}
