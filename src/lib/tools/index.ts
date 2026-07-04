import { searchDocuments } from './searchDocuments';
import { readPage } from './readPage';
import { calcRatio } from './calcRatio';
import { queryLedger, type LedgerQuery } from './queryLedger';

export interface ToolSpec {
  name: string;
  description: string;
  /** Compact usage line shown to the model in the system prompt. */
  usage: string;
  run: (args: Record<string, unknown>) => unknown | Promise<unknown>;
}

export const TOOLS: ToolSpec[] = [
  {
    name: 'search_documents',
    description: 'Semantic/keyword search across all indexed documents (agreement, amendments, filings, statements, certificates). Returns top pages with snippets.',
    usage: 'search_documents{"query": "leverage ratio covenant threshold", "docType": "amendment"?}',
    run: (args) => searchDocuments(String(args.query ?? ''), { docType: args.docType ? String(args.docType) : undefined }),
  },
  {
    name: 'read_page',
    description: 'Read the full ground-truth text of one page of a document.',
    usage: 'read_page{"docId": "credit-agreement-2023", "page": 7}',
    run: (args) => readPage(String(args.docId ?? ''), Number(args.page ?? 0)),
  },
  {
    name: 'calc_ratio',
    description: 'Deterministic covenant ratio calculator from the financial database. Metrics: "leverage" (Net Debt / LTM EBITDA), "dscr" (LTM EBITDA / Debt Service). Never compute ratios yourself.',
    usage: 'calc_ratio{"metric": "leverage", "quarter": "Q3-2025"}',
    run: (args) => calcRatio(String(args.metric ?? ''), String(args.quarter ?? '')),
  },
  {
    name: 'query_ledger',
    description: 'Query the Q3-2025 operating account ledger (504 rows). Filters: contains, category (payroll|lease|insurance|subcontracting|fuel|tolls|legal|capex|financing|intercompany|treasury|interest|revenue|suppliers|maintenance|admin), minAbsAmountEur, dateFrom, dateTo, sort, limit.',
    usage: 'query_ledger{"minAbsAmountEur": 200000, "dateFrom": "2025-07-01", "dateTo": "2025-09-30"}',
    run: (args) => queryLedger(args as LedgerQuery),
  },
];

export const toolByName = (name: string): ToolSpec | undefined =>
  TOOLS.find((t) => t.name === name);

export const toolCatalogForPrompt = (): string =>
  TOOLS.map((t) => `- ${t.name}: ${t.description}\n  usage: ${t.usage}`).join('\n');
