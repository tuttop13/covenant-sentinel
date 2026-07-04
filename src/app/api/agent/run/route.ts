import { NextRequest } from 'next/server';
import { appConfig } from '@/config/app.config';
import { runAgent } from '@/lib/agent/orchestrator';
import type { AgentEvent, AgentEventType } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/run?docId=q3-2025-filing
 * Streams the full agent run as Server-Sent Events (one JSON AgentEvent per message).
 */
export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get('docId') ?? appConfig.demo.arrivalDocId;
  const runId = `run-${Date.now().toString(36)}`;
  const encoder = new TextEncoder();
  let seq = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const emit = (type: AgentEventType, title: string, detail?: string, payload?: unknown) =>
        send({ id: `${runId}-${seq}`, runId, seq: seq++, ts: Date.now(), type, title, detail, payload });

      try {
        await runAgent(docId, emit);
      } catch (e) {
        emit('error', 'Agent run failed', e instanceof Error ? e.message : String(e));
        emit('done', 'Run aborted');
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
