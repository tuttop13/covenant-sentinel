import OpenAI from 'openai';
import { appConfig } from '@/config/app.config';
import { mockComplete } from './mock';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMUsage {
  calls: number;
  promptTokens: number;
  completionTokens: number;
}

export const usageCounter: LLMUsage = { calls: 0, promptTokens: 0, completionTokens: 0 };

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

/**
 * Single entry point for every LLM call in the app.
 * `tag` identifies the call site (plan | investigate | draft | skeptic | resolve)
 * — used by the mock provider to stay in-character, and for logging.
 */
export async function complete(tag: string, messages: LLMMessage[]): Promise<string> {
  usageCounter.calls += 1;

  if (appConfig.llm.provider === 'mock') {
    return mockComplete(tag, messages);
  }

  const res = await getClient().chat.completions.create({
    model: appConfig.llm.vultr.model,
    messages,
    temperature: appConfig.llm.vultr.temperature,
    max_tokens: appConfig.llm.vultr.maxTokens,
  });
  usageCounter.promptTokens += res.usage?.prompt_tokens ?? 0;
  usageCounter.completionTokens += res.usage?.completion_tokens ?? 0;
  return res.choices[0]?.message?.content ?? '';
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
