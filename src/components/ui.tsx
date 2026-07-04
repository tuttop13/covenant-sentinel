import type { MemoStatus } from '@/lib/types';

export const fmtEur = (n: number) =>
  (n < 0 ? '−' : '+') + '€' + Math.abs(n).toLocaleString('en-US');

export const STATUS_STYLE: Record<MemoStatus, string> = {
  OK: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EARLY_WARNING: 'bg-amber-50 text-amber-800 border-amber-200',
  BREACH: 'bg-red-50 text-red-700 border-red-200',
};

export function StatusChip({ status }: { status: MemoStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${STATUS_STYLE[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function PanelTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-2.5">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">{children}</h2>
      {right}
    </div>
  );
}
