import { NextRequest } from 'next/server';
import { finalMemoOf, loadRun } from '@/lib/eval/evaluate';
import { judgeMemo } from '@/lib/eval/judge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/eval/judge?docId=… — LLM-as-judge over that scenario's last saved memo. */
export async function POST(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get('docId');
  if (!docId) return Response.json({ error: 'docId required' }, { status: 400 });

  const events = loadRun(docId);
  if (!events) return Response.json({ error: `No saved run for ${docId} — do a live run first.` }, { status: 404 });
  const fin = finalMemoOf(events);
  if (!fin) return Response.json({ error: 'Saved run has no final memo.' }, { status: 404 });

  try {
    return Response.json(await judgeMemo(docId, fin.memo));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
