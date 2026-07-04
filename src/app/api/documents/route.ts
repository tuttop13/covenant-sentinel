import { getCorpus } from '@/lib/data/corpus';

export const runtime = 'nodejs';

/** GET /api/documents — corpus index + full pages (used by inbox and page viewer). */
export async function GET() {
  const docs = getCorpus().map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    date: d.date,
    arrivesViaInbox: d.arrivesViaInbox ?? false,
    pageCount: d.pages.length,
    pages: d.pages,
  }));
  return Response.json({ documents: docs });
}
