import { appConfig } from '@/config/app.config';
import { getCorpus } from '@/lib/data/corpus';
import type { SearchResult } from '@/lib/types';

/**
 * Keyword/BM25-lite search over corpus pages.
 * Deliberately provider-shaped: swap in a VultronRetriever/vector-store
 * implementation behind the same signature without touching the agent.
 */

const tokenize = (s: string): string[] =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9.]+/).filter((t) => t.length > 1);

const STOP = new Set(['the', 'of', 'and', 'to', 'in', 'for', 'on', 'at', 'by', 'or', 'an', 'be', 'is', 'are', 'any', 'not', 'with', 'that', 'this', 'shall', 'each']);

export function searchDocuments(query: string, opts?: { docType?: string }): SearchResult[] {
  const qTokens = tokenize(query).filter((t) => !STOP.has(t));
  if (qTokens.length === 0) return [];

  const pages: { docId: string; docTitle: string; docType: string; page: number; heading: string; text: string }[] = [];
  for (const doc of getCorpus()) {
    if (opts?.docType && doc.type !== opts.docType) continue;
    for (const p of doc.pages) {
      pages.push({ docId: doc.id, docTitle: doc.title, docType: doc.type, page: p.n, heading: p.heading, text: p.bodyText });
    }
  }

  const N = pages.length;
  const df = new Map<string, number>();
  const pageTokens = pages.map((p) => tokenize(p.text));
  for (const tok of qTokens) {
    df.set(tok, pageTokens.filter((pt) => pt.includes(tok)).length || 0);
  }

  const scored = pages.map((p, i) => {
    const toks = pageTokens[i];
    const len = toks.length || 1;
    let score = 0;
    for (const tok of qTokens) {
      const tf = toks.filter((t) => t === tok).length / len;
      if (tf === 0) continue;
      const idf = Math.log(1 + N / (1 + (df.get(tok) ?? 0)));
      score += tf * idf;
    }
    // small boost when heading matches (section titles carry meaning)
    const headingHit = qTokens.some((t) => p.heading.toLowerCase().includes(t));
    if (headingHit) score *= 1.35;
    return { p, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, appConfig.retrieval.topK)
    .map(({ p, score }) => {
      const idx = qTokens
        .map((t) => p.text.toLowerCase().indexOf(t))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b)[0] ?? 0;
      const start = Math.max(0, idx - 40);
      return {
        docId: p.docId,
        docTitle: p.docTitle,
        docType: p.docType as SearchResult['docType'],
        page: p.page,
        heading: p.heading,
        snippet: (start > 0 ? '…' : '') + p.text.slice(start, start + appConfig.retrieval.snippetChars).trim() + '…',
        score: Number(score.toFixed(4)),
      };
    });
}
