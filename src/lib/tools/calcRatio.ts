import { getFinancials } from '@/lib/data/corpus';
import type { RatioResult } from '@/lib/types';

/**
 * Deterministic financial ratio calculator. No LLM math — the agent must
 * call this tool so every figure in the memo is reproducible.
 */
export function calcRatio(metric: string, quarter: string): RatioResult | { error: string } {
  const f = getFinancials().find((x) => x.quarter.toLowerCase() === quarter.toLowerCase());
  if (!f) {
    return { error: `Unknown quarter "${quarter}". Available: ${getFinancials().map((x) => x.quarter).join(', ')}` };
  }
  if (f.ltmEbitdaK <= 0) return { error: `LTM EBITDA unavailable for ${f.quarter} (insufficient history).` };

  switch (metric) {
    case 'leverage': {
      const value = f.netDebtK / f.ltmEbitdaK;
      return {
        metric: 'leverage', period: f.quarter,
        formula: 'Total Net Debt / Consolidated EBITDA (LTM)',
        inputs: {
          totalNetDebtK: f.netDebtK,
          grossDebtK: f.grossDebtK,
          cashK: f.cashK,
          ltmEbitdaK: f.ltmEbitdaK,
        },
        value: Number(value.toFixed(2)), unit: 'x',
      };
    }
    case 'dscr': {
      const debtService = f.ltmInterestK + f.ltmScheduledAmortK;
      const value = f.ltmEbitdaK / debtService;
      return {
        metric: 'dscr', period: f.quarter,
        formula: 'Consolidated EBITDA (LTM) / (LTM interest paid + LTM scheduled principal)',
        inputs: { ltmEbitdaK: f.ltmEbitdaK, ltmInterestK: f.ltmInterestK, ltmScheduledAmortK: f.ltmScheduledAmortK, debtServiceK: debtService },
        value: Number(value.toFixed(2)), unit: 'x',
      };
    }
    default:
      return { error: `Unknown metric "${metric}". Supported: leverage, dscr.` };
  }
}
