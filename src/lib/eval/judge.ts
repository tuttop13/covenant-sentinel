import { appConfig } from '@/config/app.config';
import { completeJson } from '@/lib/llm/client';
import { getDocument } from '@/lib/data/corpus';
import type { JudgeResult, Memo } from '@/lib/types';

const JUDGE_SYSTEM = `You are an independent evaluation judge for AI-generated credit memos. You are NOT part of the production pipeline.
You receive (a) a final covenant memo and (b) the full text of every page it cites.
Score two dimensions from 0 to 100:
- faithfulness: every factual claim in the memo is supported by the cited sources; no invented figures, clauses or causes.
- completeness: the memo covers what the sources make material — thresholds actually applicable, both covenants, causes of movement, unexplained items.
Be strict but fair. Respond with ONE JSON object only, no prose:
{"faithfulness": <0-100>, "completeness": <0-100>, "comments": ["<short observation>", ...]} (max 3 comments)`;

/** LLM-as-judge on a model deliberately absent from the production pipeline. */
export async function judgeMemo(docId: string, memo: Memo): Promise<JudgeResult> {
  const citedPages = new Map<string, string>();
  for (const f of memo.findings ?? []) {
    for (const c of f.citations ?? []) {
      const key = `${c.docId} page ${c.page}`;
      if (citedPages.has(key)) continue;
      const page = getDocument(c.docId)?.pages.find((p) => p.n === c.page);
      if (page) citedPages.set(key, page.bodyText.slice(0, 2000));
    }
  }

  const sources = [...citedPages.entries()]
    .map(([key, text]) => `=== SOURCE: ${key} ===\n${text}`)
    .join('\n\n');

  const res = await completeJson<{ faithfulness: number; completeness: number; comments: string[] }>('judge', [
    { role: 'system', content: JUDGE_SYSTEM },
    { role: 'user', content: `MEMO UNDER EVALUATION:\n${JSON.stringify(memo, null, 1)}\n\nCITED SOURCES:\n${sources}` },
  ]);

  return {
    docId,
    model: appConfig.llm.vultr.judgeModel,
    faithfulness: Math.max(0, Math.min(100, Math.round(res.faithfulness))),
    completeness: Math.max(0, Math.min(100, Math.round(res.completeness))),
    comments: (res.comments ?? []).slice(0, 3),
  };
}
