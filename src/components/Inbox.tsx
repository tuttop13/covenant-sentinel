'use client';

import type { CorpusDocument } from '@/lib/types';

const TYPE_ICON: Record<string, string> = {
  agreement: '📜',
  amendment: '📎',
  financials: '📈',
  certificate: '🖋️',
  filing: '📬',
};

export interface Covenant {
  id: string;
  label: string;
  threshold: string;
  clause: string;
}

export function Inbox({
  docs, covenants, arrivalDocId, arrived, running, onArrive, onReset, onOpenDoc,
}: {
  docs: CorpusDocument[];
  covenants: Covenant[];
  arrivalDocId: string;
  arrived: boolean;
  running: boolean;
  onArrive: () => void;
  onReset: () => void;
  onOpenDoc: (docId: string) => void;
}) {
  const filing = docs.find((d) => d.id === arrivalDocId);
  const indexed = docs.filter((d) => d.id !== arrivalDocId);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-300">Document inbox</h3>
        {!arrived ? (
          <>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Sentinel monitors this inbox. New filings wake it automatically.
            </p>
            <button
              onClick={onArrive}
              disabled={!filing}
              className="mt-3 w-full rounded-lg border border-indigo-400/50 bg-indigo-500/20 px-3 py-2.5 text-sm font-semibold text-indigo-100 transition-all hover:bg-indigo-500/35 hover:shadow-[0_0_20px_rgba(99,102,241,0.25)] disabled:opacity-40"
            >
              📬 Simulate arrival: Q3-2025 filing
            </button>
          </>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <button
              onClick={() => filing && onOpenDoc(filing.id)}
              className="flex items-start gap-2 rounded-lg border border-indigo-400/40 bg-indigo-500/15 p-2.5 text-left transition-colors hover:bg-indigo-500/25"
            >
              <span>📬</span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-slate-100">{filing?.title}</span>
                <span className="text-[10px] text-indigo-300">{running ? '● being processed by Sentinel' : '✓ processed'}</span>
              </span>
            </button>
            <button
              onClick={onReset}
              disabled={running}
              className="rounded border border-slate-700 px-2 py-1.5 text-[11px] text-slate-400 transition-colors hover:bg-slate-800 disabled:opacity-40"
            >
              ↺ Reset demo
            </button>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Covenant watchlist</h3>
        <div className="flex flex-col gap-1.5">
          {covenants.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-2.5 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">{c.label}</span>
                <span className="font-mono text-xs text-slate-300">{c.threshold}</span>
              </div>
              <span className="text-[10px] text-slate-500">Senior Facilities Agreement {c.clause} · tested quarterly</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Indexed credit file <span className="text-slate-600">({indexed.length} docs)</span>
        </h3>
        <div className="flex flex-col gap-1">
          {indexed.map((d) => (
            <button
              key={d.id}
              onClick={() => onOpenDoc(d.id)}
              className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-slate-700 hover:bg-slate-800/60"
            >
              <span className="text-sm">{TYPE_ICON[d.type] ?? '📄'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium text-slate-300">{d.title}</span>
                <span className="text-[10px] text-slate-500">{d.date} · {d.pages.length}p</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
