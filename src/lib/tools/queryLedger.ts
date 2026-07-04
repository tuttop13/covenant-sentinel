import { getLedger } from '@/lib/data/corpus';
import type { LedgerRow } from '@/lib/types';

export interface LedgerQuery {
  /** case-insensitive match against description + counterparty + id */
  contains?: string;
  category?: string;
  minAbsAmountEur?: number;
  dateFrom?: string;
  dateTo?: string;
  /** 'abs_amount_desc' (default) | 'date_asc' */
  sort?: string;
  limit?: number;
}

export interface LedgerQueryResult {
  matchCount: number;
  totalCredits: number;
  totalDebits: number;
  rows: LedgerRow[];
}

export function queryLedger(q: LedgerQuery): LedgerQueryResult {
  let rows = getLedger();

  if (q.contains) {
    const needle = q.contains.toLowerCase();
    rows = rows.filter((r) =>
      r.description.toLowerCase().includes(needle) ||
      r.counterparty.toLowerCase().includes(needle) ||
      r.id.toLowerCase().includes(needle));
  }
  if (q.category) rows = rows.filter((r) => r.category === q.category);
  if (q.minAbsAmountEur) rows = rows.filter((r) => Math.abs(r.amountEur) >= q.minAbsAmountEur!);
  if (q.dateFrom) rows = rows.filter((r) => r.date >= q.dateFrom!);
  if (q.dateTo) rows = rows.filter((r) => r.date <= q.dateTo!);

  const totalCredits = rows.filter((r) => r.amountEur > 0).reduce((s, r) => s + r.amountEur, 0);
  const totalDebits = rows.filter((r) => r.amountEur < 0).reduce((s, r) => s + r.amountEur, 0);

  rows = [...rows].sort(
    q.sort === 'date_asc'
      ? (a, b) => a.date.localeCompare(b.date)
      : (a, b) => Math.abs(b.amountEur) - Math.abs(a.amountEur)
  );

  return {
    matchCount: rows.length,
    totalCredits,
    totalDebits,
    rows: rows.slice(0, Math.min(q.limit ?? 10, 25)),
  };
}
