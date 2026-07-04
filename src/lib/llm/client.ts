import OpenAI from 'openai';
import { appConfig } from '@/config/app.config';
import type { RunUsage } from '@/lib/types';
import { mockComplete } from './mock';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Per-run usage/cost accounting. The orchestrator installs a tracker at run
 * start; every completion (and rerank call) records into it, priced with the
 * Vultr public price list — so the demo can show the real cost of a run.
 */
export class RunUsageTracker {
  private byModel = new Map<string, { calls: number; promptTokens: number; completionTokens: number }>();

  record(model: string, promptTokens: number, completionTokens: number): void {
    const m = this.byModel.get(model) ?? { calls: 0, promptTokens: 0, completionTokens: 0 };
    m.calls += 1;
    m.promptTokens += promptTokens;
    m.completionTokens += completionTokens;
    this.byModel.set(model, m);
  }

  snapshot(): RunUsage {
    const pricing = appConfig.llm.pricingPer1M;
    const byModel = [...this.byModel.entries()].map(([model, m]) => {
      const p = pricing[model] ?? { in: 0, out: 0 };
      return {
        model,
        ...m,
        costUsd: (m.promptTokens * p.in + m.completionTokens * p.out) / 1_000_000,
      };
    });
    return {
      byModel,
      totalCalls: byModel.reduce((s, m) => s + m.calls, 0),
      totalTokens: byModel.reduce((s, m) => s + m.promptTokens + m.completionTokens, 0),
      totalCostUsd: byModel.reduce((s, m) => s + m.costUsd, 0),
    };
  }
}

let activeTracker: RunUsageTracker | null = null;
export function setActiveTracker(t: RunUsageTracker | null): void {
  activeTracker = t;
}
export function recordUsage(model: string, promptTokens: number, completionTokens: number): void {
  activeTracker?.record(model, promptTokens, completionTokens);
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: appConfig.llm.vultr.baseURL,
      apiKey: appConfig.llm.vultr.apiKey,
      timeout: appConfig.llm.vultr.requestTimeoutMs,
      maxRetries: 2,
    });
  }
  return client;
}

/** Model per role: Skeptic, triage and judge deliberately run on different brains than Sentinel. */
function modelForTag(tag: string): string {
  const cfg = appConfig.llm.vultr;
  if (tag === 'skeptic') return cfg.skepticModel;
  if (tag === 'triage') return cfg.triageModel;
  if (tag === 'judge') return cfg.judgeModel;
  return cfg.model;
}

/**
 * Single entry point for every LLM call in the app.
 * `tag` identifies the call site (triage | plan | investigate | draft | skeptic | judge).
 */
export async function complete(
  tag: string,
  messages: LLMMessage[],
  opts?: { maxTokens?: number },
): Promise<string> {
  if (appConfig.llm.provider === 'mock') {
    return mockComplete(tag, messages);
  }

  const cfg = appConfig.llm.vultr;
  const model = modelForTag(tag);
  const res = await getClient().chat.completions.create({
    model,
    messages,
    temperature: cfg.temperature,
    max_tokens: opts?.maxTokens ?? cfg.maxTokensByTag[tag] ?? cfg.maxTokensByTag.default,
  });
  recordUsage(model, res.usage?.prompt_tokens ?? 0, res.usage?.completion_tokens ?? 0);
  return res.choices[0]?.message?.content ?? '';
}

/**
 * complete() + extractJson() with one self-healing retry: if the reply is
 * truncated or not valid JSON, re-ask with an explicit compactness instruction.
 */
export async function completeJson<T>(tag: string, messages: LLMMessage[]): Promise<T> {
  const first = await complete(tag, messages);
  try {
    return extractJson<T>(first);
  } catch {
    const cfg = appConfig.llm.vultr;
    const budget = cfg.maxTokensByTag[tag] ?? cfg.maxTokensByTag.default;
    const retryMessages: LLMMessage[] = [
      ...messages,
      { role: 'assistant', content: first.slice(0, 800) },
      {
        role: 'user',
        content:
          'Your previous reply was invalid or truncated. Respond again with ONLY the complete JSON object — compact, single line, minimal deliberation, no prose, no code fences. Shorten free-text fields if needed to fit.',
      },
    ];
    // Truncation is the usual culprit — double the output budget on retry.
    return extractJson<T>(await complete(tag, retryMessages, { maxTokens: budget * 2 }));
  }
}

/** Extract the first top-level JSON object from a model reply (tolerates prose/fences). */
export function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  if (start === -1) throw new Error(`No JSON object in model reply: ${raw.slice(0, 200)}`);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1)) as T;
    }
  }
  throw new Error(`Unbalanced JSON in model reply: ${raw.slice(0, 200)}`);
}
