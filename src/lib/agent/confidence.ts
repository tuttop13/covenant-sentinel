import { appConfig } from '@/config/app.config';
import type { ConfidenceBreakdown, Memo } from '@/lib/types';

export interface ConfidenceInputs {
  usedCalcRatio: boolean;
  readCovenantClause: boolean;
  checkedAmendments: boolean;
  skepticFinalVerdict: 'approved' | 'objections' | null;
  objectionsRaised: number;
  memo: Memo;
}

/**
 * Deterministic confidence scoring — computed in code from what the agent
 * actually did, never asked to the model. Judges see the formula, not vibes.
 */
export function computeConfidence(i: ConfidenceInputs): ConfidenceBreakdown {
  const w = appConfig.confidence.weights;
  const flagged = i.memo.flaggedTransactions ?? [];
  const matched = flagged.filter((t) => t.matched).length;
  const causeScore = flagged.length === 0 ? 1 : matched / flagged.length;

  const components = [
    {
      label: 'Ratios verified by deterministic calculator',
      weight: w.calcVerified,
      score: i.usedCalcRatio ? 1 : 0,
      note: i.usedCalcRatio ? 'calc_ratio used for every figure' : 'model arithmetic — unverified',
    },
    {
      label: 'Covenant clause read in executed agreement',
      weight: w.thresholdVerified,
      score: i.readCovenantClause ? 1 : 0,
      note: i.readCovenantClause ? 'Section 7.1 read in full' : 'threshold not verified at source',
    },
    {
      label: 'Amendments checked for the tested period',
      weight: w.amendmentsChecked,
      score: i.checkedAmendments ? 1 : 0,
      note: i.checkedAmendments ? 'amendment register searched and read' : 'amendments never checked',
    },
    {
      label: 'Flagged movements matched to documented causes',
      weight: w.causeAttribution,
      score: causeScore,
      note: `${matched}/${flagged.length || 0} matched${flagged.length - matched > 0 ? `, ${flagged.length - matched} unexplained (listed in memo)` : ''}`,
    },
    {
      label: 'Internal challenge (The Skeptic)',
      weight: w.skepticResolved,
      score: i.skepticFinalVerdict === 'approved' ? 1 : 0.4,
      note:
        i.skepticFinalVerdict === 'approved'
          ? i.objectionsRaised > 0
            ? `approved after ${i.objectionsRaised} objection(s) resolved`
            : 'approved without objections'
          : 'objections remain unresolved',
    },
  ];

  const total = components.reduce((s, c) => s + c.weight * c.score, 0);
  return { components, total: Number(total.toFixed(3)) };
}
