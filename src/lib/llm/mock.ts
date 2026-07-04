import type { LLMMessage } from './client';

/**
 * Scripted LLM provider — lets the whole agent pipeline run with zero API calls.
 * Plays the exact demo storyline: apparent breach → Skeptic objection →
 * amendment discovered → revised EARLY_WARNING memo.
 * Decisions are keyed off markers the orchestrator embeds in its prompts.
 */

const j = (o: unknown) => JSON.stringify(o, null, 2);

function countToolResults(prompt: string): number {
  return (prompt.match(/TOOL RESULT #/g) ?? []).length;
}

const INITIAL_MEMO = {
  title: 'Covenant Escalation Memo — Meridian Logistics SA — Q3-2025',
  status: 'BREACH',
  summary:
    'Q3-2025 quarterly filing indicates a Leverage Ratio of 3.70x against the Section 7.1(a) covenant of 3.50x — an apparent covenant breach. The deterioration is driven by a EUR 1.2m one-off litigation settlement depressing LTM EBITDA and a EUR 2.8m revolver-funded equipment purchase increasing Total Net Debt.',
  findings: [
    {
      text: 'Section 7.1(a) of the Senior Facilities Agreement requires the Leverage Ratio not to exceed 3.50:1.00 for each Measurement Period, tested quarterly.',
      citations: [
        { docId: 'credit-agreement-2023', page: 7, quote: 'does not exceed 3.50:1.00' },
      ],
    },
    {
      text: 'Recomputed Leverage Ratio for Q3-2025 is 3.70x (Total Net Debt EUR 81.4m / LTM EBITDA EUR 22.0m), confirmed via the deterministic ratio calculator. DSCR remains compliant at 2.56x vs the 1.25x floor.',
      citations: [
        { docId: 'q3-2025-filing', page: 3, quote: 'LTM EBITDA (last twelve months)' },
      ],
    },
    {
      text: 'Primary causes identified in the ledger: the Aurora Freight litigation settlement (EUR 1.2m, LEGAL-SETTLE-0847) reduced EBITDA, and the electric fleet purchase (EUR 2.8m, EQUIP-PURCH-0912) funded by a Revolving Facility drawdown increased net debt. Litigation settlements may NOT be excluded from Consolidated EBITDA absent written lender approval.',
      citations: [
        { docId: 'q3-2025-filing', page: 1, quote: 'EUR 1,200 thousand charge in operating expenses in connection with the final settlement of the Aurora Freight SARL litigation' },
        { docId: 'credit-agreement-2023', page: 3, quote: 'exceptional items including litigation settlements shall NOT be excluded from Consolidated EBITDA' },
      ],
    },
  ],
  flaggedTransactions: [
    { id: 'LEGAL-SETTLE-0847', amountEur: -1200000, matched: true, cause: 'Aurora Freight litigation settlement disclosed in Q3 management commentary' },
    { id: 'EQUIP-PURCH-0912', amountEur: -2800000, matched: true, cause: 'Fleet electrification purchase, funded by revolver drawdown REVOLVER-DRAW-0901' },
    { id: 'MISC-ADJ-0203', amountEur: -410000, matched: false },
    { id: 'FX-REVAL-0331', amountEur: -275000, matched: false },
  ],
  recommendation:
    'Escalate to the credit committee as an Event of Default under Section 8.2 upon delivery of the Q3 Compliance Certificate. Notify the Borrower and assess reservation-of-rights letter. Consider whether an Equity Cure under Section 7.2 is available.',
};

const REVISED_MEMO = {
  title: 'Covenant Monitoring Memo — Meridian Logistics SA — Q3-2025 (Revised after internal challenge)',
  status: 'EARLY_WARNING',
  summary:
    'Initial assessment flagged an apparent breach of the 3.50x leverage covenant (recomputed Q3-2025 leverage: 3.70x). Following internal challenge, Amendment Agreement No. 2 was identified: a covenant holiday raises the threshold to 4.00x for the Q3-2025 and Q4-2025 Measurement Periods. Meridian is therefore COMPLIANT for Q3-2025 — but leverage sits only 0.30x below the temporary ceiling and 0.20x ABOVE the 3.50x level that automatically reverts in Q1-2026. Classified as EARLY WARNING.',
  findings: [
    {
      text: 'Section 7.1(a) of the Senior Facilities Agreement sets the Leverage Ratio covenant at 3.50:1.00.',
      citations: [
        { docId: 'credit-agreement-2023', page: 7, quote: 'does not exceed 3.50:1.00' },
      ],
    },
    {
      text: 'Amendment Agreement No. 2 (20 June 2025) grants a covenant holiday: for the Measurement Periods ending 30 September 2025 and 31 December 2025 only, the ceiling is 4.00:1.00, reverting automatically thereafter.',
      citations: [
        { docId: 'amendment-2', page: 2, quote: 'the Borrower shall ensure that the Leverage Ratio does not exceed 4.00:1.00' },
        { docId: 'amendment-2', page: 2, quote: 'shall revert to 3.50:1.00' },
      ],
    },
    {
      text: 'Recomputed Q3-2025 Leverage Ratio: 3.70x (Total Net Debt EUR 81.4m / LTM EBITDA EUR 22.0m) — compliant under the holiday, non-compliant under the reverting threshold. DSCR: 2.56x, compliant. The Amendment No. 2 minimum liquidity condition (EUR 3.0m) is met: quarter-end cash EUR 3.8m.',
      citations: [
        { docId: 'amendment-2', page: 2, quote: 'the Borrower shall maintain Cash and Cash Equivalents of not less than EUR 3,000,000' },
        { docId: 'q3-2025-filing', page: 1, quote: 'quarter-end liquidity decreased to EUR 3,800 thousand' },
      ],
    },
    {
      text: 'Causes reconciled in the ledger: EUR 1.2m Aurora Freight litigation settlement (EBITDA impact; not excludable from Consolidated EBITDA absent lender approval) and EUR 2.8m fleet electrification purchase funded by a revolver drawdown (net debt impact) — the same programme contemplated by Amendment No. 2. Two material movements remain unexplained and are listed below.',
      citations: [
        { docId: 'q3-2025-filing', page: 1, quote: 'EUR 1,200 thousand charge in operating expenses in connection with the final settlement of the Aurora Freight SARL litigation' },
        { docId: 'q3-2025-filing', page: 1, quote: 'purchase of twelve electric trucks and associated charging infrastructure from Nordvolt Fleet Systems for EUR 2,800 thousand' },
        { docId: 'credit-agreement-2023', page: 3, quote: 'exceptional items including litigation settlements shall NOT be excluded from Consolidated EBITDA' },
      ],
    },
  ],
  flaggedTransactions: [
    { id: 'LEGAL-SETTLE-0847', amountEur: -1200000, matched: true, cause: 'Aurora Freight litigation settlement disclosed in Q3 management commentary' },
    { id: 'EQUIP-PURCH-0912', amountEur: -2800000, matched: true, cause: 'Fleet electrification capex under the programme contemplated by Amendment No. 2, funded by REVOLVER-DRAW-0901' },
    { id: 'MISC-ADJ-0203', amountEur: -410000, matched: false },
    { id: 'FX-REVAL-0331', amountEur: -275000, matched: false },
  ],
  recommendation:
    'No Event of Default for Q3-2025 (Amendment No. 2 holiday applies; minimum liquidity condition met). Open an EARLY WARNING file: at 3.70x, the Borrower is above the 3.50x threshold that reverts in Q1-2026. Request a deleveraging path from the Borrower with the Q4 Compliance Certificate, obtain explanations for MISC-ADJ-0203 (EUR 410k) and FX-REVAL-0331 (EUR 275k), and diarise a Q4-2025 re-test with committee visibility.',
};

export function mockComplete(tag: string, messages: LLMMessage[]): string {
  const prompt = messages.map((m) => m.content).join('\n');
  const results = countToolResults(prompt);
  const resolving = prompt.includes('OUTSTANDING OBJECTIONS');

  switch (tag) {
    case 'plan':
      return j({
        goal: 'Assess Q3-2025 covenant compliance for Meridian Logistics SA following arrival of the quarterly filing, identify causes of any deterioration, and produce an escalation-grade memo with citations.',
        steps: [
          'Read the Q3-2025 filing commentary and financial extracts',
          'Verify covenant definitions and thresholds in the Senior Facilities Agreement',
          'Recompute Leverage and DSCR with the deterministic calculator',
          'If a covenant is stressed, query the ledger for material causes',
          'Draft memo with verbatim citations, then submit for internal challenge',
        ],
      });

    case 'investigate': {
      if (resolving) {
        if (results < 6)
          return j({
            thought: 'The Skeptic is right: I verified §7.1(a) but never checked whether any Amendment Agreement modifies the threshold in effect for Q3-2025. Section 9.2 says amendments prevail. Searching amendments now.',
            action: 'search_documents',
            args: { query: 'amendment leverage ratio covenant threshold measurement period', docType: 'amendment' },
          });
        if (results < 7)
          return j({
            thought: 'Amendment Agreement No. 2 mentions a covenant holiday. Reading its operative provisions in full before revising any conclusion.',
            action: 'read_page',
            args: { docId: 'amendment-2', page: 2 },
          });
        return j({
          thought: 'Amendment No. 2 raises the Q3/Q4-2025 ceiling to 4.00x with a EUR 3.0m minimum liquidity condition (met: EUR 3.8m cash). My BREACH conclusion was wrong — revising to EARLY WARNING with the reversion risk front and center.',
          action: 'draft_memo',
          args: {},
        });
      }
      if (results < 1)
        return j({
          thought: 'A new quarterly filing arrived for a monitored borrower. First, locate the financial covenant definitions and thresholds in the facility documentation.',
          action: 'search_documents',
          args: { query: 'leverage ratio financial covenant threshold measurement period' },
        });
      if (results < 2)
        return j({
          thought: 'Section 7.1 of the Senior Facilities Agreement is the covenant clause. Reading it in full to get exact thresholds and test mechanics.',
          action: 'read_page',
          args: { docId: 'credit-agreement-2023', page: 7 },
        });
      if (results < 3)
        return j({
          thought: 'Thresholds confirmed: leverage ≤ 3.50x, DSCR ≥ 1.25x, tested quarterly on LTM basis. Recomputing the Q3-2025 leverage ratio with the deterministic calculator — I never do covenant math freehand.',
          action: 'calc_ratio',
          args: { metric: 'leverage', quarter: 'Q3-2025' },
        });
      if (results < 4)
        return j({
          thought: 'Leverage is 3.70x vs a 3.50x covenant — apparent breach. Checking the second covenant before concluding.',
          action: 'calc_ratio',
          args: { metric: 'dscr', quarter: 'Q3-2025' },
        });
      if (results < 5)
        return j({
          thought: 'DSCR is compliant at 2.56x. Now hunting the cause of the leverage spike: querying the ledger for material Q3 movements above EUR 200k.',
          action: 'query_ledger',
          args: { minAbsAmountEur: 200000, dateFrom: '2025-07-01', dateTo: '2025-09-30', limit: 15 },
        });
      return j({
        thought: 'Causes identified: a EUR 1.2m litigation settlement (EBITDA hit — and the agreement forbids excluding settlements from Consolidated EBITDA without approval) plus a EUR 2.8m equipment purchase funded by a revolver draw (net debt hit). Two movements remain unexplained: MISC-ADJ-0203 and FX-REVAL-0331. Drafting the escalation memo.',
        action: 'draft_memo',
        args: {},
      });
    }

    case 'draft':
      return j(prompt.includes('AMENDMENT AGREEMENT NO. 2 — OPERATIVE PROVISIONS') ? REVISED_MEMO : INITIAL_MEMO);

    case 'skeptic': {
      if (prompt.includes('amendment-2')) {
        return j({ verdict: 'approved', objections: [] });
      }
      return j({
        verdict: 'objections',
        objections: [
          {
            id: 'OBJ-1',
            target: 'Threshold basis (Section 7.1(a) = 3.50x)',
            objection: 'The memo declares a BREACH against the original 3.50x threshold, but the investigation log shows no check of Amendment Agreements. Section 9.2 states amendments prevail over the Agreement to the extent of any inconsistency. If any amendment modifies Section 7.1(a) for the Q3-2025 Measurement Period, the memo\'s central conclusion is wrong.',
            requiredAction: 'Search all Amendment Agreements for provisions affecting Section 7.1(a) in effect for the Measurement Period ending 30 September 2025, and re-state the applicable threshold with a citation.',
          },
          {
            id: 'OBJ-2',
            target: 'Unexplained ledger movements',
            objection: 'Two material movements (MISC-ADJ-0203, EUR 410k; FX-REVAL-0331, EUR 275k) are flagged but neither matched to a documented cause nor explicitly carried as outstanding items with a materiality note. An escalation memo cannot silently absorb unexplained cash movements.',
            requiredAction: 'Either match both transactions to disclosed causes, or list them as unexplained outstanding items in the recommendation with amounts and follow-up owner.',
          },
        ],
      });
    }

    default:
      return j({ error: `mock: unknown tag ${tag}` });
  }
}
