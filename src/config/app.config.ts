/**
 * Central configuration — every tunable knob for Covenant Sentinel lives here.
 * Change providers, models, thresholds or demo behavior without touching code.
 * Values can be overridden via environment variables (see .env.example).
 */

const env = (key: string, fallback = ''): string => process.env[key] ?? fallback;

const vultrApiKey = env('VULTR_INFERENCE_API_KEY');

export type LLMProviderName = 'vultr' | 'mock';

export const appConfig = {
  app: {
    name: 'Covenant Sentinel',
    bank: 'Volta Bank AG',
    borrower: 'Meridian Logistics SA',
    facility: 'EUR 40,000,000 Senior Term & Revolving Facility (2023)',
  },

  llm: {
    /** 'vultr' when a key is present, 'mock' otherwise. Force with LLM_PROVIDER. */
    provider: (env('LLM_PROVIDER') || (vultrApiKey ? 'vultr' : 'mock')) as LLMProviderName,
    vultr: {
      baseURL: env('VULTR_INFERENCE_BASE_URL', 'https://api.vultrinference.com/v1'),
      apiKey: vultrApiKey,
      /** Tool-calling capable model on Vultr Serverless Inference. */
      model: env('VULTR_MODEL', 'kimi-k2-instruct'),
      temperature: 0.2,
      maxTokens: 2200,
      requestTimeoutMs: 90_000,
    },
  },

  agent: {
    maxInvestigateSteps: 12,
    maxResolutionSteps: 8,
    maxSkepticRounds: 2,
    /** Truncate tool results injected back into the conversation. */
    maxObservationChars: 3200,
  },

  retrieval: {
    topK: 5,
    snippetChars: 260,
  },

  confidence: {
    weights: {
      calcVerified: 0.15,
      thresholdVerified: 0.2,
      amendmentsChecked: 0.25,
      causeAttribution: 0.3,
      skepticResolved: 0.1,
    },
  },

  demo: {
    /** The document whose "arrival" wakes the agent. */
    arrivalDocId: 'q3-2025-filing',
    covenants: [
      { id: 'leverage', label: 'Max Leverage Ratio', threshold: '≤ 3.50x', clause: '§7.1(a)' },
      { id: 'dscr', label: 'Min Debt Service Coverage', threshold: '≥ 1.25x', clause: '§7.1(b)' },
    ],
  },

  paths: {
    dataDir: 'data',
    corpusFile: 'corpus.json',
    ledgerFile: 'ledger.csv',
    financialsFile: 'financials.json',
  },
} as const;

export type AppConfig = typeof appConfig;
