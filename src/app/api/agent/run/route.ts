import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { appConfig } from '@/config/app.config';
import { runAgent } from '@/lib/agent/orchestrator';
import type { AgentEvent, AgentEventType } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RUNS_DIR = join(process.cwd(), appConfig.paths.dataDir, 'runs');
const LAST_RUN = join(RUNS_DIR, 'last-run.json');

const sseHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};

/**
 * GET /api/agent/run?docId=q3-2025-filing        → live agent run (streamed)
 * GET /api/agent/run?replay=1                    → replay the last successful run
 *
 * Every successful live run is persisted so the demo can be replayed instantly
 * (demo insurance: video recording, flaky wifi at judging, credit exhaustion).
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('replay')) return replayLastRun();

  const docId = req.nextUrl.searchParams.get('docId') ?? appConfig.demo.arrivalDocId;
  const runId = `run-${Date.now().toString(36)}`;
  const encoder = new TextEncoder();
  const events: AgentEvent[] = [];
  let seq = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        events.push(event);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const emit = (type: AgentEventType, title: string, detail?: string, payload?: unknown) =>
        send({ id: `${runId}-${seq}`, runId, seq: seq++, ts: Date.now(), type, title, detail, payload });

      try {
        await runAgent(docId, emit);
        if (events.some((e) => e.type === 'memo_final')) {
          mkdirSync(RUNS_DIR, { recursive: true });
          writeFileSync(LAST_RUN, JSON.stringify(events, null, 1));
        }
      } catch (e) {
        emit('error', 'Agent run failed', e instanceof Error ? e.message : String(e));
        emit('done', 'Run aborted');
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders });
}

/** Stream a saved run with realistic pacing (tool latency compressed). */
function replayLastRun(): Response {
  if (!existsSync(LAST_RUN)) {
    return Response.json({ error: 'No saved run to replay — do a live run first.' }, { status: 404 });
  }
  const events = JSON.parse(readFileSync(LAST_RUN, 'utf-8')) as AgentEvent[];
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < events.length; i++) {
        if (i > 0) {
          const gap = events[i].ts - events[i - 1].ts;
          await new Promise((r) => setTimeout(r, Math.min(Math.max(gap / 6, 250), 1800)));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...events[i], ts: Date.now() })}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: sseHeaders });
}
