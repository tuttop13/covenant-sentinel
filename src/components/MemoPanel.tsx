'use client';

import type { Citation, ConfidenceBreakdown, Memo, Objection } from '@/lib/types';
import { fmtEur, StatusChip } from './ui';

export interface CitationRef extends Citation {
  n: number;
}

/** Assign stable [n] numbers to citations in reading order. */
export function numberCitations(memo: Memo): Map<string, CitationRef> {
  const map = new Map<string, CitationRef>();
  let n = 0;
  for (const f of memo.findings ?? []) {
    for (const c of f.citations ?? []) {
      const key = `${c.docId}#${c.page}#${c.quote}`;
      if (!map.has(key)) map.set(key, { ...c, n: ++n });
    }
  }
  return map;
}

function CitationChip({ cite, onOpen }: { cite: CitationRef; onOpen: (c: CitationRef) => void }) {
  return (
    <button
      onClick={() => onOpen(cite)}
      title={`${cite.docId} — page ${cite.page}${cite.verified === false ? ' (quote not verified!)' : ''}`}
      className={`ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border px-1 align-super font-mono text-[10px] font-bold transition-colors ${
        cite.verified === false
          ? 'border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/25'
          : 'border-sky-500/50 bg-sky-500/10 text-sky-300 hover:bg-sky-500/25'
      }`}
    >
      {cite.n}
    </button>
  );
}

function ConfidenceBlock({ confidence }: { confidence: ConfidenceBreakdown }) {
  const pct = Math.round(confidence.total * 100);
  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-300">Confidence — computed, not vibes</h4>
        <span className="font-mono text-xl font-bold text-violet-200">{pct}%</span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {confidence.components.map((c) => (
          <div key={c.label}>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>{c.label} <span className="text-slate-600">· w={c.weight}</span></span>
              <span className="font-mono">{Math.round(c.score * 100)}%</span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-slate-800">
              <div
                className={`h-full rounded ${c.score >= 0.99 ? 'bg-violet-400' : c.score >= 0.5 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${Math.max(3, c.score * 100)}%` }}
              />
            </div>
            <p className="mt-0.5 text-[10px] italic text-slate-500">{c.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MemoPanel({
  memo, confidence, objections, isFinal, skepticApproved, onOpenCitation,
}: {
  memo: Memo | null;
  confidence: ConfidenceBreakdown | null;
  objections: Objection[];
  isFinal: boolean;
  skepticApproved: boolean;
  onOpenCitation: (c: CitationRef) => void;
}) {
  if (!memo) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <div className="text-4xl">📄</div>
        <p className="text-sm font-medium text-slate-300">No memo yet</p>
        <p className="max-w-xs text-xs text-slate-500">
          The memo appears here as Sentinel drafts it — and updates live when The Skeptic forces a revision.
        </p>
      </div>
    );
  }

  const cites = numberCitations(memo);
  const keyOf = (c: Citation) => `${c.docId}#${c.page}#${c.quote}`;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-slate-100">{memo.title}</h3>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusChip status={memo.status} />
          <span className={`text-[10px] font-medium uppercase tracking-wider ${isFinal ? (skepticApproved ? 'text-emerald-400' : 'text-amber-400') : 'text-amber-400'}`}>
            {isFinal ? (skepticApproved ? 'Final — Skeptic approved' : 'Final — reservations noted') : 'Draft — under review'}
          </span>
        </div>
      </div>

      <p className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-xs leading-relaxed text-slate-300">
        {memo.summary}
      </p>

      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Findings</h4>
        <ol className="flex flex-col gap-2">
          {(memo.findings ?? []).map((f, i) => (
            <li key={i} className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-2.5 text-xs leading-relaxed text-slate-300">
              <span className="mr-1.5 font-mono text-[10px] text-slate-500">{i + 1}.</span>
              {f.text}
              {(f.citations ?? []).map((c) => (
                <CitationChip key={keyOf(c)} cite={cites.get(keyOf(c))!} onOpen={onOpenCitation} />
              ))}
            </li>
          ))}
        </ol>
      </div>

      {(memo.flaggedTransactions ?? []).length > 0 && (
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Flagged movements</h4>
          <div className="overflow-hidden rounded-lg border border-slate-700/70">
            <table className="w-full text-[11px]">
              <tbody>
                {memo.flaggedTransactions.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800 last:border-0">
                    <td className="px-2 py-1.5 font-mono text-slate-300">{t.id}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-300">{fmtEur(t.amountEur)}</td>
                    <td className="px-2 py-1.5">
                      {t.matched ? (
                        <span className="text-emerald-400" title={t.cause}>✓ matched</span>
                      ) : (
                        <span className="text-amber-400">? unexplained</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {objections.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-300">⚔️ Skeptic challenge log</h4>
          <div className="flex flex-col gap-1.5">
            {objections.map((o) => (
              <div key={o.id} className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 text-[11px] leading-relaxed">
                <p className="font-semibold text-red-200">{o.id} — {o.target}</p>
                <p className="mt-0.5 text-slate-300">{o.objection}</p>
                <p className="mt-1 text-slate-400"><span className="font-semibold text-slate-300">Required:</span> {o.requiredAction}</p>
                {isFinal && skepticApproved && <p className="mt-1 font-medium text-emerald-400">✓ Addressed in revised memo</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
        <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Recommendation</h4>
        <p className="text-xs leading-relaxed text-slate-300">{memo.recommendation}</p>
      </div>

      {confidence && <ConfidenceBlock confidence={confidence} />}
    </div>
  );
}
