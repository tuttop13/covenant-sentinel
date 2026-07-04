'use client';

import { useEffect } from 'react';
import type { CorpusDocument } from '@/lib/types';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Wrap the quote in <mark> inside the page HTML (best-effort, case-insensitive). */
function highlight(html: string, quote?: string): { html: string; found: boolean } {
  if (!quote) return { html, found: false };
  const re = new RegExp(escapeRegExp(quote), 'i');
  if (re.test(html)) return { html: html.replace(re, (m) => `<mark>${m}</mark>`), found: true };
  return { html, found: false };
}

export function DocViewer({
  doc, page, quote, onClose, onNav,
}: {
  doc: CorpusDocument;
  page: number;
  quote?: string;
  onClose: () => void;
  onNav: (page: number) => void;
}) {
  const p = doc.pages.find((x) => x.n === page) ?? doc.pages[0];
  const { html, found } = highlight(p.bodyHtml, quote);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-3xl flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/90 px-4 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">{doc.title}</p>
            <p className="text-[11px] text-slate-400">{doc.type.toUpperCase()} · dated {doc.date} · page {p.n} / {doc.pages.length}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onNav(Math.max(1, p.n - 1))}
              disabled={p.n <= 1}
              className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-30"
            >← Prev</button>
            <button
              onClick={() => onNav(Math.min(doc.pages.length, p.n + 1))}
              disabled={p.n >= doc.pages.length}
              className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-30"
            >Next →</button>
            <button
              onClick={onClose}
              className="ml-2 rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:bg-red-500/20 hover:text-red-200"
            >✕ Close</button>
          </div>
        </div>

        <div className="overflow-y-auto rounded-sm">
          <div className="scan-page mx-auto min-h-[420px] w-full rotate-[0.15deg] px-10 py-9">
            <p className="mb-1 text-center text-[10px] uppercase tracking-[0.3em] text-[#8a7f66]">
              {doc.title} — page {p.n} of {doc.pages.length}
            </p>
            <h3 className="mb-4 border-b border-[#c9bfa4] pb-2 text-center text-[15px] font-bold tracking-wide">
              {p.heading}
            </h3>
            <div className="text-[13px]" dangerouslySetInnerHTML={{ __html: html }} />
            <p className="mt-6 text-center text-[9px] tracking-[0.2em] text-[#8a7f66]">
              VOLTA BANK AG · CREDIT FILE MERIDIAN LOGISTICS SA · INDEXED COPY
            </p>
          </div>
        </div>

        {quote && !found && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Cited passage (not auto-located on this page): “{quote}”
          </div>
        )}
      </div>
    </div>
  );
}
