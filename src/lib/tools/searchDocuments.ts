import { appConfig } from '@/config/app.config';
import { getCorpus } from '@/lib/data/corpus';
import { recordUsage } from '@/lib/llm/client';
import type { SearchResult } from '@/lib/types';

/**
 * Two retrieval providers behind one signature:
 *  - 'vultron': VultronRetriever reranker served on Vultr Serverless Inference
 *  - 'keyword': local BM25-lite (also the automatic fallback on any API failure)
 */

export interface SearchResponse {
  provider: string;
  results: SearchResult[];
  note?: string;
}

const tokenize = (s: string): string[] =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9.]+/).filter((t) => t.length > 1);

const STOP = new Set(['the', 'of', 'and', 'to', 'in', 'for', 'on', 'at', 'by', 'or', 'an', 'be', 'is', 'are', 'any', 'not', 'with', 'that', 'this', 'shall', 'each']);

interface IndexedPage {
  docId: string;
  docTitle: string;
  docType: string;
  page: number;
  heading: string;
  text: string;
}

function collectPages(opts?: { docType?: string }): IndexedPage[] {
  const pages: IndexedPage[] = [];
  const filter = opts?.docType;
  // Tolerate the model passing a docId where a docType is expected.
  const isDocId = !!filter && getCorpus().some((d) => d.id === filter);
  for (const doc of getCorpus()) {
    if (filter && (isDocId ? doc.id !== filter : doc.type !== filter)) continue;
    for (const p of doc.pages) {
      pages.push({ docId: doc.id, docTitle: doc.title, docType: doc.type, page: p.n, heading: p.heading, text: p.bodyText });
    }
  }
  return pages;
}

function makeSnippet(text: string, query: string): string {
  const qTokens = tokenize(query).filter((t) => !STOP.has(t));
  const idx = qTokens
    .map((t) => text.toLowerCase().indexOf(t))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, idx - 40);
  return (start > 0 ? '…' : '') + text.slice(start, start + appConfig.retrieval.snippetChars).trim() + '…';
}

async function vultronSearch(query: string, opts?: { docType?: string }): Promise<SearchResult[]> {
  const pages = collectPages(opts);
  const res = await fetch(`${appConfig.llm.vultr.baseURL}/rerank`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appConfig.llm.vultr.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: appConfig.retrieval.rerankModel,
      query,
      documents: pages.map((p) => `${p.heading}\n${p.text}`.slice(0, 2400)),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`rerank HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    results: { index: number; relevance_score: number }[];
    usage?: { prompt_tokens?: number; total_tokens?: number };
  };
  // Rerank usage for the cost meter — estimated at 4 chars/token when the API omits it.
  const estTokens = Math.round(pages.reduce((s, p) => s + Math.min(p.text.length, 2400), query.length) / 4);
  recordUsage(appConfig.retrieval.rerankModel, data.usage?.prompt_tokens ?? data.usage?.total_tokens ?? estTokens, 0);
  return data.results
    .slice(0, appConfig.retrieval.topK)
    .map((r) => {
      const p = pages[r.index];
      return {
        docId: p.docId,
        docTitle: p.docTitle,
        docType: p.docType as SearchResult['docType'],
        page: p.page,
        heading: p.heading,
        snippet: makeSnippet(p.text, query),
        score: Number(r.relevance_score.toFixed(4)),
      };
    });
}

const emptyNote = (opts?: { docType?: string }) =>
  `0 results${opts?.docType ? ` with docType="${opts.docType}"` : ''} — retry with broader terms${opts?.docType ? ' or without docType' : ''}. Valid docTypes: agreement, amendment, financials, certificate, filing.`;

export async function searchDocuments(query: string, opts?: { docType?: string }): Promise<SearchResponse> {
  if (appConfig.retrieval.provider === 'vultron' && appConfig.llm.vultr.apiKey) {
    try {
      const results = await vultronSearch(query, opts);
      return {
        provider: appConfig.retrieval.rerankModel,
        results,
        ...(results.length === 0 ? { note: emptyNote(opts) } : {}),
      };
    } catch (e) {
      console.warn('[search] vultron rerank failed, falling back to keyword:', e);
    }
  }
  const results = keywordSearch(query, opts);
  return {
    provider: 'keyword-bm25-local',
    results,
    ...(results.length === 0 ? { note: emptyNote(opts) } : {}),
  };
}

function keywordSearch(query: string, opts?: { docType?: string }): SearchResult[] {
  const qTokens = tokenize(query).filter((t) => !STOP.has(t));
  if (qTokens.length === 0) return [];

  const pages = collectPages(opts);
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
    .map(({ p, score }) => ({
      docId: p.docId,
      docTitle: p.docTitle,
      docType: p.docType as SearchResult['docType'],
      page: p.page,
      heading: p.heading,
      snippet: makeSnippet(p.text, query),
      score: Number(score.toFixed(4)),
    }));
}
