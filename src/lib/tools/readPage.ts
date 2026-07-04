import { getDocument } from '@/lib/data/corpus';

export interface ReadPageResult {
  docId: string;
  docTitle: string;
  page: number;
  heading: string;
  text: string;
  totalPages: number;
}

export function readPage(docId: string, page: number): ReadPageResult | { error: string } {
  const doc = getDocument(docId);
  if (!doc) return { error: `Unknown document id "${docId}". Use search_documents first.` };
  const p = doc.pages.find((x) => x.n === page);
  if (!p) return { error: `Document "${docId}" has no page ${page} (1..${doc.pages.length}).` };
  return {
    docId: doc.id,
    docTitle: doc.title,
    page: p.n,
    heading: p.heading,
    text: p.bodyText,
    totalPages: doc.pages.length,
  };
}
