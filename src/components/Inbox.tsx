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

export interface Scenario {
  docId: string;
  label: string;
  hint: string;
}

export function Inbox({
  docs, covenants, scenarios, activeDocId, arrived, running, onArrive, onReplay, onReset, onOpenDoc,
}: {
  docs: CorpusDocument[];
  covenants: Covenant[];
  scenarios: Scenario[];
  activeDocId: string | null;
  arrived: boolean;
  running: boolean;
  onArrive: (docId: string) => void;
  onReplay: (docId: string) => void;
  onReset: () => void;
  onOpenDoc: (docId: string) => void;
}) {
  const arrivalIds = new Set(scenarios.map((s) => s.docId));
  const filing = activeDocId ? docs.find((d) => d.id === activeDocId) : null;
  const indexed = docs.filter((d) => !arrivalIds.has(d.id));

  return (
    <div className="flex flex-col gap-4 bg-white p-4">
      <div className="rounded-lg border border-indigo-300 bg-indigo-50 p-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-700">Document inbox</h3>
        {!arrived ? (
          <>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Sentinel monitors this inbox. Pick which filing arrives — the agent decides the outcome on its own.
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {scenarios.map((s) => (
                <div key={s.docId} className="flex items-stretch gap-1">
                  <button
                    onClick={() => onArrive(s.docId)}
                    className="flex flex-1 items-center justify-between rounded-lg border border-indigo-300 bg-indigo-600 px-3 py-2 text-left transition-all hover:bg-indigo-700"
                  >
                    <span className="text-xs font-semibold text-white">📬 {s.label}</span>
                    <span className="text-[10px] text-indigo-200">{s.hint}</span>
                  </button>
                  <button
                    onClick={() => onReplay(s.docId)}
                    className="rounded border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
                    title={`Replay the last saved live run for ${s.label} (no API calls)`}
                  >
                    ▶
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              ▶ replays that scenario&apos;s last live run instantly, without API calls.
            </p>
          </>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <button
              onClick={() => filing && onOpenDoc(filing.id)}
              className="flex items-start gap-2 rounded-lg border border-indigo-300 bg-white p-2.5 text-left transition-colors hover:bg-indigo-50"
            >
              <span>📬</span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-slate-900">{filing?.title ?? activeDocId}</span>
                <span className="text-[10px] font-medium text-indigo-600">{running ? '● being processed by Sentinel' : '✓ processed'}</span>
              </span>
            </button>
            <button
              onClick={onReset}
              disabled={running}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40"
            >
              ↺ Reset demo
            </button>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Covenant watchlist</h3>
        <div className="flex flex-col gap-1.5">
          {covenants.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">{c.label}</span>
                <span className="font-mono text-xs font-semibold text-slate-800">{c.threshold}</span>
              </div>
              <span className="text-[10px] text-slate-500">Senior Facilities Agreement {c.clause} · tested quarterly</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Indexed credit file <span className="text-slate-400">({indexed.length} docs)</span>
        </h3>
        <div className="flex flex-col gap-1">
          {indexed.map((d) => (
            <button
              key={d.id}
              onClick={() => onOpenDoc(d.id)}
              className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-100"
            >
              <span className="text-sm">{TYPE_ICON[d.type] ?? '📄'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium text-slate-800">{d.title}</span>
                <span className="text-[10px] text-slate-500">{d.date} · {d.pages.length}p</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
