'use client';

import { useEffect, useRef } from 'react';
import type { AgentEvent } from '@/lib/types';

const EVENT_META: Record<string, { icon: string; tone: string }> = {
  run_started: { icon: '📥', tone: 'border-indigo-500/40 bg-indigo-500/10' },
  thought: { icon: '💭', tone: 'border-slate-700 bg-slate-800/40' },
  tool_call: { icon: '⚙️', tone: 'border-sky-500/40 bg-sky-500/10' },
  tool_result: { icon: '↩️', tone: 'border-slate-700 bg-slate-900/60' },
  memo_draft: { icon: '📝', tone: 'border-amber-500/40 bg-amber-500/10' },
  skeptic_objection: { icon: '⚔️', tone: 'border-red-500/50 bg-red-500/10' },
  skeptic_verdict: { icon: '🛡️', tone: 'border-emerald-500/40 bg-emerald-500/10' },
  resolution_note: { icon: '🔧', tone: 'border-slate-700 bg-slate-800/40' },
  confidence: { icon: '📊', tone: 'border-violet-500/40 bg-violet-500/10' },
  memo_final: { icon: '🏁', tone: 'border-emerald-500/50 bg-emerald-500/10' },
  error: { icon: '⛔', tone: 'border-red-600/60 bg-red-600/15' },
  done: { icon: '✓', tone: 'border-slate-700 bg-slate-800/40' },
};

function EventCard({ ev }: { ev: AgentEvent }) {
  if (ev.type === 'phase') {
    return (
      <div className="event-in flex items-center gap-3 pt-3">
        <div className="h-px flex-1 bg-slate-700/70" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{ev.title}</span>
        <div className="h-px flex-1 bg-slate-700/70" />
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
            <p className={`text-[13px] font-medium ${skeptic ? 'text-red-100' : 'text-slate-200'}`}>
              {skeptic && ev.type === 'skeptic_objection' && (
                <span className="mr-1.5 rounded bg-red-500/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200">The Skeptic</span>
              )}
              {ev.title}
            </p>
            <span className="shrink-0 font-mono text-[10px] text-slate-500">
              {new Date(ev.ts).toLocaleTimeString('en-GB')}
            </span>
          </div>
          {ev.detail && (
            <p className={`mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed ${ev.type === 'tool_call' || ev.type === 'tool_result' ? 'font-mono text-[11px] text-slate-400' : 'text-slate-300'}`}>
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
        <p className="text-sm font-medium text-slate-300">Sentinel is idle — monitoring the inbox</p>
        <p className="max-w-sm text-xs leading-relaxed text-slate-500">
          When a document arrives, the agent wakes up on its own: it plans, retrieves evidence,
          recalculates ratios, queries the ledger — and defends its memo against The Skeptic
          before you ever see it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {events.map((ev) => <EventCard key={ev.id} ev={ev} />)}
      {running && (
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-400">
          <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-sky-400" />
          Sentinel is working…
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
