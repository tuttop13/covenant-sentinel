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
      /** Sentinel (plan / investigate / draft) — reasoning model, strong agentic behavior. */
      model: env('VULTR_MODEL', 'moonshotai/Kimi-K2.6'),
      /** The Skeptic — deliberately a DIFFERENT brain than the drafter. */
      skepticModel: env('VULTR_SKEPTIC_MODEL', 'deepseek-ai/DeepSeek-V4-Flash'),
      /** Triage — cheapest model on the platform gates the expensive ones. */
      triageModel: env('VULTR_TRIAGE_MODEL', 'nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-BF16'),
      /** LLM-as-judge for the eval harness — a model NOT used anywhere in the pipeline. */
      judgeModel: env('VULTR_JUDGE_MODEL', 'Qwen/Qwen3.6-27B'),
      temperature: 0.2,
      /** Reasoning models burn tokens thinking before answering — budgets per phase. */
      maxTokensByTag: {
        triage: 4000,
        plan: 5000,
        investigate: 7000,
        draft: 16000,
        skeptic: 10000,
        judge: 6000,
        default: 8000,
      } as Record<string, number>,
      requestTimeoutMs: 120_000,
    },
    /** USD per 1M tokens (input, output) — Vultr Serverless Inference price list. */
    pricingPer1M: {
      'moonshotai/Kimi-K2.6': { in: 0.30, out: 1.20 },
      'deepseek-ai/DeepSeek-V4-Flash': { in: 0.30, out: 1.00 },
      'nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-BF16': { in: 0.13, out: 0.38 },
      'nvidia/Nemotron-Cascade-2-30B-A3B': { in: 0.15, out: 0.60 },
      'Qwen/Qwen3.6-27B': { in: 0.30, out: 2.00 },
      'vultr/VultronRetrieverFlash-Qwen3.5-0.8B': { in: 0.05, out: 0.25 },
      'vultr/VultronRetrieverCore-Qwen3.5-4.5B': { in: 0.10, out: 0.50 },
    } as Record<string, { in: number; out: number }>,
  },

  agent: {
    maxInvestigateSteps: 8,
    maxResolutionSteps: 5,
    /** One objection wave + resolution + redraft, then a final sign-off pass. */
    maxSkepticRounds: 1,
    /** Truncate tool results injected back into the conversation. */
    maxObservationChars: 2400,
  },

  retrieval: {
    /** 'vultron' = VultronRetriever rerank on Vultr; 'keyword' = local BM25-lite.
     *  Auto-falls back to keyword on any API failure. */
    provider: env('RETRIEVAL_PROVIDER', vultrApiKey ? 'vultron' : 'keyword') as 'vultron' | 'keyword',
    rerankModel: env('VULTR_RERANK_MODEL', 'vultr/VultronRetrieverFlash-Qwen3.5-0.8B'),
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
    /** Inbox scenarios — each filing arrival wakes the agent with a different outcome. */
    scenarios: [
      {
        docId: 'q2-2025-filing',
        label: 'Q2-2025 filing',
        hint: 'Routine quarter',
        window: { from: '2025-04-01', to: '2025-06-30' },
      },
      {
        docId: 'q3-2025-filing',
        label: 'Q3-2025 filing',
        hint: 'The interesting one',
        window: { from: '2025-07-01', to: '2025-09-30' },
      },
      {
        docId: 'q4-2025-filing',
        label: 'Q4-2025 filing',
        hint: 'Distressed quarter',
        window: { from: '2025-10-01', to: '2025-12-31' },
      },
    ],
    covenants: [
      { id: 'leverage', label: 'Max Leverage Ratio', threshold: '≤ 3.50x', clause: '§7.1(a)' },
      { id: 'dscr', label: 'Min Debt Service Coverage', threshold: '≥ 1.25x', clause: '§7.1(b)' },
    ],
  },

  /** Code-enforced completeness: material one-off movements the memo MUST carry. */
  materiality: {
    thresholdEur: 200_000,
    oneOffCategories: ['legal', 'capex', 'intercompany', 'treasury', 'writeoff', 'advisory'],
  },

  paths: {
    dataDir: 'data',
    corpusFile: 'corpus.json',
    ledgerFile: 'ledger.csv',
    financialsFile: 'financials.json',
  },
} as const;

export type AppConfig = typeof appConfig;
