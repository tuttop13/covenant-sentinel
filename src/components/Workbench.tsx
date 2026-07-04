'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentEvent, ConfidenceBreakdown, CorpusDocument, Memo, Objection } from '@/lib/types';
import { DocViewer } from './DocViewer';
import { Inbox, type Covenant } from './Inbox';
import { MemoPanel, type CitationRef } from './MemoPanel';
import { Timeline } from './Timeline';
import { PanelTitle } from './ui';

interface Health {
  provider: 'vultr' | 'mock';
  model: string;
  app: { name: string; bank: string; borrower: string; facility: string };
  covenants: Covenant[];
  arrivalDocId: string;
}

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
  const [confidence, setConfidence] = useState<ConfidenceBreakdown | null>(null);
  const [objections, setObjections] = useState<Objection[]>([]);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setHealth);
    fetch('/api/documents').then((r) => r.json()).then((d) => setDocs(d.documents));
    return () => esRef.current?.close();
  }, []);

  const startRun = useCallback(() => {
    if (!health || running) return;
    setArrived(true);
    setRunning(true);
    setEvents([]);
    setMemo(null);
    setIsFinal(false);
    setConfidence(null);
    setObjections([]);

    const es = new EventSource(`/api/agent/run?docId=${health.arrivalDocId}`);
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
        case 'memo_final': {
          const p = ev.payload as { memo: Memo; confidence: ConfidenceBreakdown };
          setMemo(p.memo);
          setConfidence(p.confidence);
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
    setEvents([]);
    setMemo(null);
    setIsFinal(false);
    setConfidence(null);
    setObjections([]);
  }, []);

  const openCitation = useCallback((c: CitationRef) => {
    setViewer({ docId: c.docId, page: c.page, quote: c.quote });
  }, []);

  const viewerDoc = viewer ? docs.find((d) => d.id === viewer.docId) : null;

  return (
    <div className="flex h-screen flex-col bg-[#090c12]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛰️</span>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-slate-100">
              {health?.app.name ?? 'Covenant Sentinel'}
              <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-normal text-slate-400">
                {health?.app.bank ?? ''}
              </span>
            </h1>
            <p className="text-[11px] text-slate-500">
              {health ? `${health.app.borrower} · ${health.app.facility}` : 'loading…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {health?.provider === 'mock' ? (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              ● Mock mode — no API key
            </span>
          ) : health ? (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              ● Live — {health.model} @ Vultr
            </span>
          ) : null}
        </div>
      </header>

      {/* 3 panels */}
      <main className="grid min-h-0 min-w-[1100px] flex-1 grid-cols-[290px_minmax(0,1fr)_400px]">
        <section className="min-h-0 overflow-y-auto border-r border-slate-800">
          <PanelTitle>Credit file · inbox</PanelTitle>
          <Inbox
            docs={docs}
            covenants={health?.covenants ?? []}
            arrivalDocId={health?.arrivalDocId ?? ''}
            arrived={arrived}
            running={running}
            onArrive={startRun}
            onReset={reset}
            onOpenDoc={(docId) => setViewer({ docId, page: 1 })}
          />
        </section>

        <section className="flex min-h-0 flex-col">
          <PanelTitle
            right={running ? (
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-sky-300">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-sky-400" /> RUNNING
              </span>
            ) : undefined}
          >
            Agent trace — Sentinel &amp; The Skeptic
          </PanelTitle>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Timeline events={events} running={running} />
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto border-l border-slate-800">
          <PanelTitle>Escalation memo</PanelTitle>
          <MemoPanel
            memo={memo}
            confidence={confidence}
            objections={objections}
            isFinal={isFinal}
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
