// ---------- Corpus ----------

export type DocType = 'agreement' | 'amendment' | 'financials' | 'certificate' | 'filing';

export interface DocPage {
  n: number;
  heading: string;
  /** Plain text used for search + agent reading (ground truth). */
  bodyText: string;
  /** HTML rendered in the page viewer (same content, styled). */
  bodyHtml: string;
}

export interface CorpusDocument {
  id: string;
  title: string;
  type: DocType;
  date: string; // ISO
  /** Filings arrive via the inbox simulation; everything else is pre-indexed. */
  arrivesViaInbox?: boolean;
  pages: DocPage[];
}

export interface LedgerRow {
  id: string;
  date: string;
  account: string;
  counterparty: string;
  description: string;
  category: string;
  amountEur: number;
}

export interface QuarterFinancials {
  quarter: string; // e.g. "Q3-2025"
  revenueK: number;
  ebitdaK: number;
  depreciationK: number;
  interestExpenseK: number;
  netIncomeK: number;
  cashK: number;
  grossDebtK: number;
  netDebtK: number;
  ltmEbitdaK: number;
  ltmInterestK: number;
  ltmScheduledAmortK: number;
}

// ---------- Tools ----------

export interface Citation {
  docId: string;
  page: number;
  /** Verbatim substring of the cited page's bodyText. */
  quote: string;
  /** Set by the orchestrator: quote found verbatim in the source page. */
  verified?: boolean;
}

export interface SearchResult {
  docId: string;
  docTitle: string;
  docType: DocType;
  page: number;
  heading: string;
  snippet: string;
  score: number;
}

export interface RatioResult {
  metric: string;
  period: string;
  formula: string;
  inputs: Record<string, number>;
  value: number;
  unit: string;
}

// ---------- Memo ----------

export type MemoStatus = 'OK' | 'EARLY_WARNING' | 'BREACH';

export interface FlaggedTransaction {
  id: string;
  amountEur: number;
  matched: boolean;
  cause?: string;
}

export interface Finding {
  text: string;
  citations: Citation[];
}

export interface Memo {
  title: string;
  status: MemoStatus;
  summary: string;
  findings: Finding[];
  flaggedTransactions: FlaggedTransaction[];
  recommendation: string;
}

// ---------- Skeptic ----------

export interface Objection {
  id: string;
  target: string;
  objection: string;
  requiredAction: string;
}

export interface SkepticVerdict {
  verdict: 'approved' | 'objections';
  objections: Objection[];
}

// ---------- Confidence ----------

export interface ConfidenceComponent {
  label: string;
  weight: number;
  /** 0..1 */
  score: number;
  note: string;
}

export interface ConfidenceBreakdown {
  components: ConfidenceComponent[];
  /** 0..1 weighted total */
  total: number;
}

// ---------- Agent events (SSE trace) ----------

export type AgentEventType =
  | 'run_started'
  | 'phase'
  | 'thought'
  | 'tool_call'
  | 'tool_result'
  | 'memo_draft'
  | 'skeptic_objection'
  | 'skeptic_verdict'
  | 'resolution_note'
  | 'confidence'
  | 'memo_final'
  | 'error'
  | 'done';

export interface AgentEvent {
  id: string;
  runId: string;
  seq: number;
  ts: number;
  type: AgentEventType;
  title: string;
  detail?: string;
  payload?: unknown;
}
