import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appConfig } from '@/config/app.config';
import type { CorpusDocument, LedgerRow, QuarterFinancials } from '@/lib/types';

const dataPath = (file: string) => join(process.cwd(), appConfig.paths.dataDir, file);

let corpusCache: CorpusDocument[] | null = null;
let ledgerCache: LedgerRow[] | null = null;
let financialsCache: QuarterFinancials[] | null = null;

export function getCorpus(): CorpusDocument[] {
  if (!corpusCache) {
    corpusCache = JSON.parse(readFileSync(dataPath(appConfig.paths.corpusFile), 'utf-8'));
  }
  return corpusCache!;
}

export function getDocument(docId: string): CorpusDocument | undefined {
  return getCorpus().find((d) => d.id === docId);
}

export function getLedger(): LedgerRow[] {
  if (!ledgerCache) {
    const raw = readFileSync(dataPath(appConfig.paths.ledgerFile), 'utf-8').trim().split('\n');
    ledgerCache = raw.slice(1).map((line) => {
      // description is the only quoted field
      const m = line.match(/^([^,]*),([^,]*),([^,]*),([^,]*),"(.*)",([^,]*),(-?\d+)$/);
      if (!m) throw new Error(`Bad ledger row: ${line}`);
      return {
        id: m[1], date: m[2], account: m[3], counterparty: m[4],
        description: m[5], category: m[6], amountEur: Number(m[7]),
      };
    });
  }
  return ledgerCache!;
}

export function getFinancials(): QuarterFinancials[] {
  if (!financialsCache) {
    financialsCache = JSON.parse(readFileSync(dataPath(appConfig.paths.financialsFile), 'utf-8'));
  }
  return financialsCache!;
}
