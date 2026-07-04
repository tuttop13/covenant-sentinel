'use client';

import { useEffect, useRef } from 'react';
import type { AgentEvent } from '@/lib/types';

const EVENT_META: Record<string, { icon: string; tone: string }> = {
  run_started: { icon: '📥', tone: 'border-indigo-300 bg-indigo-50' },
  triage: { icon: '🚦', tone: 'border-violet-300 bg-violet-50' },
  cost: { icon: '💰', tone: 'border-amber-300 bg-amber-50' },
  thought: { icon: '💭', tone: 'border-slate-300 bg-slate-50' },
  tool_call: { icon: '⚙️', tone: 'border-sky-300 bg-sky-50' },
  tool_result: { icon: '↩️', tone: 'border-slate-300 bg-white' },
  memo_draft: { icon: '📝', tone: 'border-amber-300 bg-amber-50' },
  skeptic_objection: { icon: '⚔️', tone: 'border-red-300 bg-red-50' },
  skeptic_verdict: { icon: '🛡️', tone: 'border-emerald-300 bg-emerald-50' },
  resolution_note: { icon: '🔧', tone: 'border-slate-300 bg-slate-50' },
  confidence: { icon: '📊', tone: 'border-violet-300 bg-violet-50' },
  memo_final: { icon: '🏁', tone: 'border-emerald-400 bg-emerald-50' },
  error: { icon: '⛔', tone: 'border-red-400 bg-red-50' },
  done: { icon: '✓', tone: 'border-slate-300 bg-slate-50' },
};

function EventCard({ ev }: { ev: AgentEvent }) {
  if (ev.type === 'phase') {
    return (
      <div className="event-in flex items-center gap-3 pt-3">
        <div className="h-px flex-1 bg-slate-300" />
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{ev.title}</span>
        <div className="h-px flex-1 bg-slate-300" />
      </div>
    );
  }
  const meta = EVENT_META[ev.type] ?? EVENT_META.done;
  const skeptic = ev.type === 'skeptic_objection' || ev.type === 'skeptic_verdict';
  return (
    <div className={`event-in rounded-lg border px-3 py-2 ${meta.tone}`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-sm leading-none">{meta.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-[13px] font-semibold ${skeptic ? 'text-red-800' : 'text-slate-900'}`}>
              {skeptic && ev.type === 'skeptic_objection' && (
                <span className="mr-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">The Skeptic</span>
              )}
              {ev.title}
            </p>
            <span className="shrink-0 font-mono text-[10px] text-slate-400">
              {new Date(ev.ts).toLocaleTimeString('en-GB')}
            </span>
          </div>
          {ev.detail && (
            <p className={`mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed ${ev.type === 'tool_call' || ev.type === 'tool_result' ? 'font-mono text-[11px] text-slate-600' : 'text-slate-700'}`}>
              {ev.detail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function Timeline({ events, running }: { events: AgentEvent[]; running: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-4xl">🛰️</div>
        <p className="text-sm font-semibold text-slate-700">Sentinel is idle — monitoring the inbox</p>
        <p className="max-w-sm text-xs leading-relaxed text-slate-500">
          When a document arrives, the agent wakes up on its own: it plans, retrieves evidence,
          recalculates ratios, queries the ledger — and defends its memo against The Skeptic
          before you ever see it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 bg-white p-3">
      {events.map((ev) => <EventCard key={ev.id} ev={ev} />)}
      {running && (
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-600">
          <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-sky-500" />
          Sentinel is working…
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
