'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentEvent, ConfidenceBreakdown, CorpusDocument, Memo, Objection, RunUsage } from '@/lib/types';
import { DocViewer } from './DocViewer';
import { Inbox, type Covenant, type Scenario } from './Inbox';
import { MemoPanel, type CitationRef } from './MemoPanel';
import { Timeline } from './Timeline';
import { PanelTitle } from './ui';

interface Health {
  provider: 'vultr' | 'mock';
  model: string;
  skepticModel: string;
  triageModel: string;
  retrievalModel: string;
  app: { name: string; bank: string; borrower: string; facility: string };
  covenants: Covenant[];
  scenarios: Scenario[];
}

const shortModel = (id: string) => id.split('/').pop() ?? id;

interface ViewerState {
  docId: string;
  page: number;
  quote?: string;
}

export function Workbench() {
  const [health, setHealth] = useState<Health | null>(null);
  const [docs, setDocs] = useState<CorpusDocument[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [memo, setMemo] = useState<Memo | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [skepticApproved, setSkepticApproved] = useState(true);
  const [confidence, setConfidence] = useState<ConfidenceBreakdown | null>(null);
  const [usage, setUsage] = useState<RunUsage | null>(null);
  const [objections, setObjections] = useState<Objection[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setHealth);
    fetch('/api/documents').then((r) => r.json()).then((d) => setDocs(d.documents));
    return () => esRef.current?.close();
  }, []);

  const startRun = useCallback((docId: string, mode: 'live' | 'replay' = 'live') => {
    if (!health || running) return;
    setArrived(true);
    setRunning(true);
    setActiveDocId(docId);
    setEvents([]);
    setMemo(null);
    setIsFinal(false);
    setConfidence(null);
    setUsage(null);
    setObjections([]);

    const url = mode === 'replay'
      ? `/api/agent/run?replay=1&docId=${docId}`
      : `/api/agent/run?docId=${docId}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (msg) => {
      const ev = JSON.parse(msg.data) as AgentEvent;
      setEvents((prev) => [...prev, ev]);

      switch (ev.type) {
        case 'memo_draft':
          setMemo(ev.payload as Memo);
          setIsFinal(false);
          break;
        case 'skeptic_objection':
          setObjections((prev) => [...prev, ev.payload as Objection]);
          break;
        case 'confidence':
          setConfidence(ev.payload as ConfidenceBreakdown);
          break;
        case 'cost':
          setUsage(ev.payload as RunUsage);
          break;
        case 'memo_final': {
          const p = ev.payload as { memo: Memo; confidence: ConfidenceBreakdown; usage?: RunUsage; skepticApproved?: boolean };
          setMemo(p.memo);
          setConfidence(p.confidence);
          if (p.usage) setUsage(p.usage);
          setSkepticApproved(p.skepticApproved ?? true);
          setIsFinal(true);
          break;
        }
        case 'done':
          setRunning(false);
          es.close();
          break;
      }
    };
    es.onerror = () => {
      setRunning(false);
      es.close();
    };
  }, [health, running]);

  const reset = useCallback(() => {
    esRef.current?.close();
    setArrived(false);
    setRunning(false);
    setActiveDocId(null);
    setEvents([]);
    setMemo(null);
    setIsFinal(false);
    setConfidence(null);
    setUsage(null);
    setObjections([]);
  }, []);

  const openCitation = useCallback((c: CitationRef) => {
    setViewer({ docId: c.docId, page: c.page, quote: c.quote });
  }, []);

  const viewerDoc = viewer ? docs.find((d) => d.id === viewer.docId) : null;

  return (
    <div className="flex h-screen flex-col bg-slate-200">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛰️</span>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-white">
              {health?.app.name ?? 'Covenant Sentinel'}
              <span className="ml-2 rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] font-normal text-slate-200">
                {health?.app.bank ?? ''}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              {health ? `${health.app.borrower} · ${health.app.facility}` : 'loading…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {health?.provider === 'mock' ? (
            <span className="rounded-full border border-amber-400/60 bg-amber-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              ● Mock mode — no API key
            </span>
          ) : health ? (
            <div className="flex items-center gap-1.5 text-[10px] font-medium">
              <span className="rounded-full border border-violet-400/50 bg-violet-400/15 px-2 py-1 text-violet-300"
                title="Triage — cheapest model gates the expensive ones">
                🚦 {shortModel(health.triageModel)}
              </span>
              <span className="rounded-full border border-emerald-400/50 bg-emerald-400/15 px-2 py-1 text-emerald-300"
                title="Sentinel — investigator & drafter">
                🛰️ {shortModel(health.model)}
              </span>
              <span className="rounded-full border border-red-400/50 bg-red-400/15 px-2 py-1 text-red-300"
                title="The Skeptic — adversarial reviewer (different brain, on purpose)">
                ⚔️ {shortModel(health.skepticModel)}
              </span>
              <span className="rounded-full border border-sky-400/50 bg-sky-400/15 px-2 py-1 text-sky-300"
                title="Retrieval — reranker over the credit file">
                🔎 {shortModel(health.retrievalModel)}
              </span>
              {usage && (
                <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-1 font-mono text-amber-300"
                  title={usage.byModel.map((m) => `${shortModel(m.model)}: ${m.calls} calls · ${(m.promptTokens + m.completionTokens).toLocaleString('en-US')} tok · $${m.costUsd.toFixed(4)}`).join('\n')}>
                  ${usage.totalCostUsd.toFixed(4)} / run
                </span>
              )}
              <span className="ml-1 rounded-full border border-emerald-400/60 bg-emerald-400/20 px-2 py-1 uppercase tracking-wider text-emerald-200">
                ● Live @ Vultr
              </span>
            </div>
          ) : null}
          <a
            href="/eval"
            className="rounded-full border border-violet-400/50 bg-violet-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-300 transition-colors hover:bg-violet-400/25"
            title="Ground-truth eval harness + LLM-as-judge"
          >
            ⚖️ Evals
          </a>
        </div>
      </header>

      {/* 3 panels */}
      <main className="grid min-h-0 min-w-[1100px] flex-1 grid-cols-[290px_minmax(0,1fr)_400px] gap-px bg-slate-300">
        <section className="min-h-0 overflow-y-auto bg-white">
          <PanelTitle>Credit file · inbox</PanelTitle>
          <Inbox
            docs={docs}
            covenants={health?.covenants ?? []}
            scenarios={health?.scenarios ?? []}
            activeDocId={activeDocId}
            arrived={arrived}
            running={running}
            onArrive={(docId) => startRun(docId, 'live')}
            onReplay={(docId) => startRun(docId, 'replay')}
            onReset={reset}
            onOpenDoc={(docId) => setViewer({ docId, page: 1 })}
          />
        </section>

        <section className="flex min-h-0 flex-col bg-white">
          <PanelTitle
            right={running ? (
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-sky-600">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-sky-500" /> RUNNING
              </span>
            ) : undefined}
          >
            Agent trace — Sentinel &amp; The Skeptic
          </PanelTitle>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Timeline events={events} running={running} />
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto bg-white">
          <PanelTitle>Escalation memo</PanelTitle>
          <MemoPanel
            memo={memo}
            confidence={confidence}
            usage={usage}
            objections={objections}
            isFinal={isFinal}
            skepticApproved={skepticApproved}
            onOpenCitation={openCitation}
          />
        </section>
      </main>

      {viewerDoc && viewer && (
        <DocViewer
          doc={viewerDoc}
          page={viewer.page}
          quote={viewer.quote}
          onClose={() => setViewer(null)}
          onNav={(page) => setViewer((v) => (v ? { ...v, page, quote: undefined } : v))}
        />
      )}
    </div>
  );
}
