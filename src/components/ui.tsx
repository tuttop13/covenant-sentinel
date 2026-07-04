import type { MemoStatus } from '@/lib/types';

export const fmtEur = (n: number) =>
  (n < 0 ? '−' : '+') + '€' + Math.abs(n).toLocaleString('en-US');

export const STATUS_STYLE: Record<MemoStatus, string> = {
  OK: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  EARLY_WARNING: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  BREACH: 'bg-red-500/15 text-red-300 border-red-500/40',
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
    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{children}</h2>
      {right}
    </div>
  );
}
