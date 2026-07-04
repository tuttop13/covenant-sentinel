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
 * `tag` identifies the call site (plan | investigate | draft | skeptic)
 * — picks the model per role: The Skeptic deliberately runs on a different
 * model than Sentinel so the reviewer doesn't share the drafter's blind spots.
 */
export async function complete(
  tag: string,
  messages: LLMMessage[],
  opts?: { maxTokens?: number },
): Promise<string> {
  usageCounter.calls += 1;

  if (appConfig.llm.provider === 'mock') {
    return mockComplete(tag, messages);
  }

  const cfg = appConfig.llm.vultr;
  const model = tag === 'skeptic' ? cfg.skepticModel : cfg.model;
  const res = await getClient().chat.completions.create({
    model,
    messages,
    temperature: cfg.temperature,
    max_tokens: opts?.maxTokens ?? cfg.maxTokensByTag[tag] ?? cfg.maxTokensByTag.default,
  });
  usageCounter.promptTokens += res.usage?.prompt_tokens ?? 0;
  usageCounter.completionTokens += res.usage?.completion_tokens ?? 0;
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
