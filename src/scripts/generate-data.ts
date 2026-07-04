/**
 * Generates the entire simulated corpus for Covenant Sentinel:
 *   data/corpus.json      — credit agreement, amendments, filings, certificates
 *   data/financials.json  — quarterly financials (inputs for calc_ratio)
 *   data/ledger.csv       — ~500 operating account transactions for Q3-2025
 *
 * Deterministic (seeded RNG) so the demo story is 100% reproducible.
 * Run: node src/scripts/generate-data.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CorpusDocument, DocPage, LedgerRow, QuarterFinancials } from '../lib/types.ts';

const DATA_DIR = join(process.cwd(), 'data');

// ---------- Seeded RNG (mulberry32) ----------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260704);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const between = (min: number, max: number) => min + rng() * (max - min);

// ---------- Financial story (all figures in EUR thousands) ----------
// Q3-2025: EBITDA hit by a €1.2M one-off legal settlement + €1.0M operating dip;
// net debt up via a €2.8M revolver-funded equipment purchase and lower cash.
// LTM leverage: 3.13x (Q2) -> 3.70x (Q3). Original covenant: ≤ 3.50x.
// Amendment No. 2 (easy to miss): holiday at 4.00x for Q3/Q4-2025, reverts Q1-2026.

const quarterlyEbitda: Record<string, number> = {
  'Q4-2023': 5900, 'Q1-2024': 5600, 'Q2-2024': 6100, 'Q3-2024': 6300,
  'Q4-2024': 6000, 'Q1-2025': 5800, 'Q2-2025': 6200, 'Q3-2025': 4000,
};

const quarters = Object.keys(quarterlyEbitda);

const grossDebt: Record<string, number> = {
  'Q4-2023': 84000, 'Q1-2024': 83500, 'Q2-2024': 83000, 'Q3-2024': 82800,
  'Q4-2024': 82500, 'Q1-2025': 82300, 'Q2-2025': 82000, 'Q3-2025': 85200,
};

const cash: Record<string, number> = {
  'Q4-2023': 5200, 'Q1-2024': 5400, 'Q2-2024': 5600, 'Q3-2024': 5800,
  'Q4-2024': 6100, 'Q1-2025': 5900, 'Q2-2025': 6000, 'Q3-2025': 3800,
};

function ltm(map: Record<string, number>, quarter: string): number {
  const idx = quarters.indexOf(quarter);
  if (idx < 3) return NaN;
  return quarters.slice(idx - 3, idx + 1).reduce((s, q) => s + map[q], 0);
}

const financials: QuarterFinancials[] = quarters.map((q) => {
  const ebitda = quarterlyEbitda[q];
  const revenue = Math.round(ebitda / 0.125 / 10) * 10;
  const interest = 1150;
  const ltmEbitda = ltm(quarterlyEbitda, q);
  return {
    quarter: q,
    revenueK: revenue,
    ebitdaK: ebitda,
    depreciationK: 2100,
    interestExpenseK: interest,
    netIncomeK: Math.round((ebitda - 2100 - interest) * 0.72),
    cashK: cash[q],
    grossDebtK: grossDebt[q],
    netDebtK: grossDebt[q] - cash[q],
    ltmEbitdaK: Number.isNaN(ltmEbitda) ? 0 : ltmEbitda,
    ltmInterestK: 4600,
    ltmScheduledAmortK: 4000,
  };
});

// ---------- Page helpers ----------

const p = (...paras: string[]): { bodyText: string; bodyHtml: string } => ({
  bodyText: paras.join('\n\n'),
  bodyHtml: paras.map((t) => `<p>${t}</p>`).join('\n'),
});

const fmtK = (k: number) => (k >= 0 ? '' : '(') + Math.abs(k).toLocaleString('en-US') + (k >= 0 ? '' : ')');

function financialTable(rows: [string, number][]): { text: string; html: string } {
  const text = rows.map(([label, v]) => `${label}: EUR ${fmtK(v)} thousand`).join('\n');
  const html =
    '<table><tbody>' +
    rows.map(([label, v]) => `<tr><td>${label}</td><td class="num">${fmtK(v)}</td></tr>`).join('') +
    '</tbody></table><p class="unit">All figures in EUR thousands.</p>';
  return { text, html };
}

function page(n: number, heading: string, body: { bodyText: string; bodyHtml: string }): DocPage {
  return { n, heading, bodyText: `${heading}\n\n${body.bodyText}`, bodyHtml: body.bodyHtml };
}

// ---------- Credit Agreement ----------

const creditAgreement: CorpusDocument = {
  id: 'credit-agreement-2023',
  title: 'Senior Facilities Agreement (2023)',
  type: 'agreement',
  date: '2023-03-15',
  pages: [
    page(1, 'SENIOR FACILITIES AGREEMENT', p(
      'DATED 15 MARCH 2023. MERIDIAN LOGISTICS SA, a société anonyme incorporated in France (the "Borrower"), and VOLTA BANK AG as Agent, Arranger and Original Lender.',
      'EUR 70,000,000 SENIOR TERM LOAN FACILITY and EUR 20,000,000 REVOLVING CREDIT FACILITY.',
      'This Agreement sets out the terms on which the Lenders make the Facilities available to the Borrower for the purpose of refinancing existing indebtedness and financing the general corporate and working capital purposes of the Group.'
    )),
    page(2, 'TABLE OF CONTENTS', p(
      'Section 1. Definitions and Interpretation — page 3. Section 2. The Facilities — page 5. Section 5. Information Undertakings — page 6. Section 7. Financial Covenants — page 7. Section 7.2 Equity Cure — page 8. Section 8. Events of Default — page 9. Section 9. Amendments and Waivers — page 10. Signatures — page 11. Schedule 1. Margin Grid — page 12.'
    )),
    page(3, 'SECTION 1 — DEFINITIONS (A–E)', p(
      '"Consolidated EBITDA" means, for any Measurement Period, the consolidated operating profit of the Group before interest, taxation, depreciation and amortisation, adjusted to exclude exceptional, one-off, non-recurring or extraordinary items only to the extent expressly approved by the Majority Lenders in writing.',
      'For the avoidance of doubt, absent such written approval, exceptional items including litigation settlements shall NOT be excluded from Consolidated EBITDA.',
      '"Cash and Cash Equivalents" means cash in hand and credit balances on deposit with a Qualifying Bank, in each case freely available to the Group.'
    )),
    page(4, 'SECTION 1 — DEFINITIONS (F–Z)', p(
      '"Total Net Debt" means, at any time, the aggregate amount of all obligations of the Group for or in respect of Borrowings (including drawings under the Revolving Facility), less the aggregate amount of Cash and Cash Equivalents.',
      '"Measurement Period" means each period of twelve months ending on the last day of a Financial Quarter (a "last-twelve-months" or LTM basis).',
      '"Leverage Ratio" means the ratio of Total Net Debt on the last day of a Measurement Period to Consolidated EBITDA for that Measurement Period.',
      '"Debt Service" means, for any Measurement Period, the aggregate of interest paid and scheduled repayments of principal falling due during that period.'
    )),
    page(5, 'SECTION 2 — THE FACILITIES', p(
      'Facility A: a euro term loan facility in an aggregate amount of EUR 70,000,000, repayable in equal semi-annual instalments of EUR 2,000,000 with the balance due at Final Maturity (15 March 2030).',
      'Facility B: a euro revolving credit facility in an aggregate amount of EUR 20,000,000, available for drawing, repayment and re-drawing until one month prior to Final Maturity. Drawings under Facility B constitute Borrowings for the purposes of Total Net Debt.'
    )),
    page(6, 'SECTION 5 — INFORMATION UNDERTAKINGS', p(
      'The Borrower shall deliver to the Agent: (a) audited annual consolidated financial statements within 120 days of financial year end; (b) unaudited quarterly consolidated financial statements within 45 days of each Financial Quarter end; and (c) with each set of quarterly financial statements, a Compliance Certificate signed by the CFO setting out computations of the financial covenants in Section 7.1 in reasonable detail.'
    )),
    page(7, 'SECTION 7.1 — FINANCIAL COVENANTS', p(
      '7.1(a) Leverage. The Borrower shall ensure that the Leverage Ratio in respect of any Measurement Period ending on or after 30 June 2023 does not exceed 3.50:1.00.',
      '7.1(b) Debt Service Coverage. The Borrower shall ensure that the ratio of Consolidated EBITDA to Debt Service in respect of any Measurement Period is not less than 1.25:1.00.',
      'The financial covenants in this Section 7.1 shall be tested quarterly by reference to each Measurement Period ending on the last day of each Financial Quarter, on the basis of the quarterly financial statements and the related Compliance Certificate.'
    )),
    page(8, 'SECTION 7.2 — EQUITY CURE', p(
      'If the requirements of Section 7.1 are not satisfied for a Measurement Period, the Borrower may, no more than twice over the life of the Facilities and not in consecutive Financial Quarters, procure additional shareholder contributions in cash. Amounts so contributed shall be deemed to increase Consolidated EBITDA for the relevant Measurement Period.'
    )),
    page(9, 'SECTION 8 — EVENTS OF DEFAULT', p(
      '8.1 Non-payment: failure to pay any amount due under the Finance Documents within three Business Days of the due date.',
      '8.2 Financial covenants: failure to comply with Section 7.1, subject to Section 7.2 (Equity Cure), constitutes an Event of Default with immediate effect upon delivery (or required delivery date) of the relevant Compliance Certificate.',
      '8.3 On and at any time after the occurrence of an Event of Default which is continuing, the Agent may cancel the Total Commitments and declare all outstanding Loans immediately due and payable.'
    )),
    page(10, 'SECTION 9 — AMENDMENTS AND WAIVERS', p(
      '9.1 Any term of the Finance Documents may be amended or waived only in writing with the consent of the Majority Lenders and the Borrower, and any such amendment shall be documented as a numbered Amendment Agreement executed by the parties.',
      '9.2 Amendment Agreements form part of the Finance Documents and prevail over this Agreement to the extent of any inconsistency, for the periods and on the terms specified therein.'
    )),
    page(11, 'EXECUTION PAGE', p(
      'SIGNED for and on behalf of MERIDIAN LOGISTICS SA by its Directeur Général. SIGNED for and on behalf of VOLTA BANK AG as Agent, Arranger and Original Lender. Executed in Paris on 15 March 2023 in three originals. [STAMP: VOLTA BANK AG — LEGAL DEPARTMENT — EXECUTED COPY]'
    )),
    page(12, 'SCHEDULE 1 — APPLICABLE MARGIN GRID', p(
      'Leverage Ratio greater than 3.00:1.00 — Margin 3.25% p.a. Leverage Ratio between 2.50 and 3.00 — Margin 2.75% p.a. Leverage Ratio below 2.50:1.00 — Margin 2.25% p.a. The Applicable Margin adjusts two Business Days after receipt of each Compliance Certificate.'
    )),
  ],
};

// ---------- Amendments ----------

const amendment1: CorpusDocument = {
  id: 'amendment-1',
  title: 'Amendment Agreement No. 1',
  type: 'amendment',
  date: '2024-05-10',
  pages: [
    page(1, 'AMENDMENT AGREEMENT NO. 1', p(
      'DATED 10 MAY 2024, between MERIDIAN LOGISTICS SA and VOLTA BANK AG as Agent, relating to the Senior Facilities Agreement dated 15 March 2023.',
      'The parties agree: (i) the deadline in Section 5(b) for delivery of the Q1-2024 quarterly financial statements only is extended from 45 to 60 days; (ii) the notice details of the Agent in Section 11 are updated to 14 Quai de la Rapée, 75012 Paris.',
      'All other terms of the Agreement remain in full force and effect. This letter is designated a Finance Document.'
    )),
  ],
};

const amendment2: CorpusDocument = {
  id: 'amendment-2',
  title: 'Amendment Agreement No. 2 — Covenant Holiday',
  type: 'amendment',
  date: '2025-06-20',
  pages: [
    page(1, 'AMENDMENT AGREEMENT NO. 2 — RECITALS', p(
      'DATED 20 JUNE 2025, between MERIDIAN LOGISTICS SA and VOLTA BANK AG as Agent (with the consent of the Majority Lenders), relating to the Senior Facilities Agreement dated 15 March 2023.',
      'WHEREAS the Borrower has presented to the Lenders a fleet electrification programme involving aggregate capital expenditure of up to EUR 12,000,000 across 2025 and 2026, partly funded by drawings under the Revolving Facility;',
      'WHEREAS the Lenders wish to accommodate the temporary increase in leverage resulting from the programme.'
    )),
    page(2, 'AMENDMENT AGREEMENT NO. 2 — OPERATIVE PROVISIONS', p(
      'Clause 2.1 (Covenant Holiday). Notwithstanding Section 7.1(a) of the Agreement, for the Measurement Periods ending 30 September 2025 and 31 December 2025 only, the Borrower shall ensure that the Leverage Ratio does not exceed 4.00:1.00.',
      'Clause 2.2 (Reversion). For each Measurement Period ending on or after 31 March 2026, the ratio in Section 7.1(a) shall revert to 3.50:1.00 without further action of the parties.',
      'Clause 2.3 (Minimum Liquidity Condition). During the period referred to in Clause 2.1, the Borrower shall maintain Cash and Cash Equivalents of not less than EUR 3,000,000, tested on the last day of each Financial Quarter.',
      'Clause 2.4 This Amendment Agreement is a Finance Document and prevails over the Agreement to the extent of any inconsistency.'
    )),
  ],
};

// ---------- Quarterly financial statements ----------

function quarterEndDate(q: string): string {
  const [qq, y] = q.split('-');
  const map: Record<string, string> = { Q1: '03-31', Q2: '06-30', Q3: '09-30', Q4: '12-31' };
  return `${y}-${map[qq]}`;
}

const statementDocs: CorpusDocument[] = financials
  .filter((f) => f.quarter !== 'Q3-2025')
  .map((f) => {
    const pl = financialTable([
      ['Revenue', f.revenueK],
      ['Operating expenses', -(f.revenueK - f.ebitdaK)],
      ['EBITDA', f.ebitdaK],
      ['Depreciation and amortisation', -f.depreciationK],
      ['Net interest expense', -f.interestExpenseK],
      ['Net income', f.netIncomeK],
    ]);
    const bs = financialTable([
      ['Cash and cash equivalents', f.cashK],
      ['Total borrowings (incl. revolver drawings)', f.grossDebtK],
      ['Total net debt', f.netDebtK],
      ['LTM EBITDA (last twelve months)', f.ltmEbitdaK],
    ]);
    return {
      id: `fin-${f.quarter.toLowerCase()}`,
      title: `Quarterly Financial Statements ${f.quarter}`,
      type: 'financials' as const,
      date: quarterEndDate(f.quarter),
      pages: [
        page(1, `${f.quarter} CONSOLIDATED INCOME STATEMENT — MERIDIAN LOGISTICS SA`,
          { bodyText: pl.text, bodyHtml: pl.html }),
        page(2, `${f.quarter} CONSOLIDATED BALANCE SHEET EXTRACT AND DEBT SCHEDULE`,
          { bodyText: bs.text, bodyHtml: bs.html }),
      ],
    };
  });

// ---------- Compliance certificates (Q1/Q2-2025 precedent) ----------

function certificate(q: string, leverage: string, dscr: string): CorpusDocument {
  return {
    id: `cert-${q.toLowerCase()}`,
    title: `Compliance Certificate ${q}`,
    type: 'certificate',
    date: quarterEndDate(q),
    pages: [
      page(1, `COMPLIANCE CERTIFICATE — MEASUREMENT PERIOD ENDING ${quarterEndDate(q)}`, p(
        `Pursuant to Section 5(c) of the Senior Facilities Agreement dated 15 March 2023, the undersigned CFO of Meridian Logistics SA certifies the following computations for the Measurement Period ending ${quarterEndDate(q)}.`,
        `Leverage Ratio (Section 7.1(a)): Total Net Debt divided by Consolidated EBITDA (LTM) = ${leverage}. Requirement: not more than 3.50:1.00. Status: COMPLIANT.`,
        `Debt Service Coverage (Section 7.1(b)): Consolidated EBITDA (LTM) divided by Debt Service = ${dscr}. Requirement: not less than 1.25:1.00. Status: COMPLIANT.`,
        'No Default or Event of Default has occurred and is continuing as at the date of this certificate.'
      )),
    ],
  };
}

const certQ1 = certificate('Q1-2025', '3.21:1.00', '2.62:1.00');
const certQ2 = certificate('Q2-2025', '3.13:1.00', '2.64:1.00');

// ---------- The Q3-2025 filing (arrives via inbox — wakes the agent) ----------

const q3 = financials.find((f) => f.quarter === 'Q3-2025')!;
const q3pl = financialTable([
  ['Revenue', q3.revenueK],
  ['Operating expenses (incl. exceptional items)', -(q3.revenueK - q3.ebitdaK)],
  ['EBITDA', q3.ebitdaK],
  ['Depreciation and amortisation', -q3.depreciationK],
  ['Net interest expense', -q3.interestExpenseK],
  ['Net income', q3.netIncomeK],
]);
const q3bs = financialTable([
  ['Cash and cash equivalents', q3.cashK],
  ['Total borrowings (incl. revolver drawings)', q3.grossDebtK],
  ['Total net debt', q3.netDebtK],
  ['LTM EBITDA (last twelve months)', q3.ltmEbitdaK],
  ['LTM interest paid', q3.ltmInterestK],
  ['LTM scheduled principal repayments', q3.ltmScheduledAmortK],
]);

const q3Filing: CorpusDocument = {
  id: 'q3-2025-filing',
  title: 'Q3-2025 Quarterly Filing — Meridian Logistics SA',
  type: 'filing',
  date: '2025-11-10',
  arrivesViaInbox: true,
  pages: [
    page(1, 'Q3-2025 MANAGEMENT COMMENTARY', p(
      'The third quarter of 2025 was marked by two exceptional developments. First, the Group recognised a EUR 1,200 thousand charge in operating expenses in connection with the final settlement of the Aurora Freight SARL litigation (payment reference LEGAL-SETTLE-0847, August 2025). Second, the Group accelerated its fleet electrification programme with the purchase of twelve electric trucks and associated charging infrastructure from Nordvolt Fleet Systems for EUR 2,800 thousand (reference EQUIP-PURCH-0912), funded through a drawing under the Revolving Facility in September 2025.',
      'Operating performance was further affected by elevated fuel costs and the non-renewal of a regional distribution contract, together reducing EBITDA by approximately EUR 800 thousand relative to the prior quarter.',
      'Management notes that quarter-end liquidity decreased to EUR 3,800 thousand, and expects gradual recovery of operating margins in Q4-2025.'
    )),
    page(2, 'Q3-2025 CONSOLIDATED INCOME STATEMENT', { bodyText: q3pl.text, bodyHtml: q3pl.html }),
    page(3, 'Q3-2025 BALANCE SHEET EXTRACT AND DEBT SCHEDULE', { bodyText: q3bs.text, bodyHtml: q3bs.html }),
  ],
};

// ---------- Ledger (Q3-2025 operating account) ----------

const ledger: LedgerRow[] = [];
let rowSeq = 0;
const rid = (prefix: string) => `${prefix}-${String(++rowSeq).padStart(4, '0')}`;

function addRow(date: string, account: string, counterparty: string, description: string, category: string, amountEur: number, id?: string) {
  ledger.push({ id: id ?? rid('TXN'), date, account, counterparty, description, category, amountEur: Math.round(amountEur) });
}

const days: string[] = [];
for (let m = 7; m <= 9; m++) {
  const dim = m === 7 ? 31 : m === 8 ? 31 : 30;
  for (let d = 1; d <= dim; d++) days.push(`2025-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
}
const businessDays = days.filter((d) => ![0, 6].includes(new Date(d).getDay()));

// Recurring flows
for (const d of ['2025-07-15', '2025-07-31', '2025-08-14', '2025-08-29', '2025-09-15', '2025-09-30'])
  addRow(d, 'OPS-MAIN', 'Payroll run', 'Payroll and social charges', 'payroll', -between(780_000, 840_000));
for (const d of ['2025-07-01', '2025-08-01', '2025-09-01']) {
  addRow(d, 'OPS-MAIN', 'Atlas Real Estate', 'Depot lease — Gennevilliers hub', 'lease', -186_000);
  addRow(d, 'OPS-MAIN', 'AXA Corporate', 'Fleet insurance premium', 'insurance', -94_500);
  addRow(d, 'OPS-MAIN', 'Iberia Linehaul SL', 'Subcontracted linehaul — monthly settlement', 'subcontracting', -between(275_000, 305_000));
}
businessDays.filter((_, i) => i % 5 === 0).forEach((d) => {
  addRow(d, 'OPS-MAIN', 'TotalEnergies Fleet', 'Fuel card settlement', 'fuel', -between(95_000, 145_000));
  addRow(d, 'OPS-MAIN', 'ASFA Péage', 'Highway tolls settlement', 'tolls', -between(22_000, 38_000));
});

// Story rows (the causes + the funding leg + two deliberately unexplained items)
addRow('2025-08-14', 'OPS-MAIN', 'Aurora Freight SARL', 'Settlement — Aurora Freight SARL litigation (final)', 'legal', -1_200_000, 'LEGAL-SETTLE-0847');
addRow('2025-09-05', 'OPS-MAIN', 'Nordvolt Fleet Systems', 'Purchase — 12 electric trucks + charging infrastructure', 'capex', -2_800_000, 'EQUIP-PURCH-0912');
addRow('2025-09-03', 'OPS-MAIN', 'Volta Bank AG', 'Revolving facility drawdown', 'financing', 2_800_000, 'REVOLVER-DRAW-0901');
addRow('2025-07-28', 'OPS-MAIN', 'Meridian Iberia SL', 'Intercompany adjustment — Meridian Iberia', 'intercompany', -410_000, 'MISC-ADJ-0203');
addRow('2025-09-19', 'OPS-MAIN', 'Treasury desk', 'FX revaluation adjustment — USD exposures', 'treasury', -275_000, 'FX-REVAL-0331');
addRow('2025-09-12', 'OPS-MAIN', 'Volta Bank AG', 'Quarterly interest payment — Facility A', 'interest', -1_137_500, 'INT-PAY-0930');

// Noise: revenue receipts, supplier payments, maintenance
const clients = ['Carrefour Supply', 'Decathlon Logistics', 'Sanofi Distribution', 'Leroy Merlin Flux', 'FNAC-Darty Chain', 'Auchan Retail', 'PSA Aftermarket'];
const suppliers = ['Michelin Solutions', 'MAN Truck Service', 'Bridgestone Fleet', 'Norauto Pro', 'Manutan Collectivités', 'Rexel Équipement', 'Würth France'];
for (let i = 0; i < 250; i++)
  addRow(pick(businessDays), 'OPS-MAIN', pick(clients), 'Client receipt — freight and logistics services', 'revenue', between(18_000, 220_000));
for (let i = 0; i < 130; i++)
  addRow(pick(businessDays), 'OPS-MAIN', pick(suppliers), 'Supplier payment — parts and services', 'suppliers', -between(4_000, 90_000));
for (let i = 0; i < 45; i++)
  addRow(pick(businessDays), 'OPS-MAIN', pick(suppliers), 'Fleet maintenance and repairs', 'maintenance', -between(6_000, 55_000));
for (let i = 0; i < 30; i++)
  addRow(pick(businessDays), 'OPS-MAIN', 'Various', 'Sundry administrative expenses', 'admin', -between(1_500, 18_000));

ledger.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

// ---------- Write outputs ----------

const corpus: CorpusDocument[] = [
  creditAgreement, amendment1, amendment2,
  ...statementDocs, certQ1, certQ2, q3Filing,
];

mkdirSync(DATA_DIR, { recursive: true });

writeFileSync(join(DATA_DIR, 'corpus.json'), JSON.stringify(corpus, null, 2));
writeFileSync(join(DATA_DIR, 'financials.json'), JSON.stringify(financials, null, 2));

const csvHeader = 'id,date,account,counterparty,description,category,amount_eur';
const csvBody = ledger
  .map((r) => [r.id, r.date, r.account, r.counterparty, `"${r.description}"`, r.category, r.amountEur].join(','))
  .join('\n');
writeFileSync(join(DATA_DIR, 'ledger.csv'), `${csvHeader}\n${csvBody}\n`);

const q3f = financials.find((f) => f.quarter === 'Q3-2025')!;
console.log(`corpus.json      ${corpus.length} documents, ${corpus.reduce((s, d) => s + d.pages.length, 0)} pages`);
console.log(`ledger.csv       ${ledger.length} transactions`);
console.log(`financials.json  ${financials.length} quarters`);
console.log(`Q3-2025 check    net debt ${q3f.netDebtK}K / LTM EBITDA ${q3f.ltmEbitdaK}K = ${(q3f.netDebtK / q3f.ltmEbitdaK).toFixed(2)}x (original covenant 3.50x, holiday 4.00x)`);
